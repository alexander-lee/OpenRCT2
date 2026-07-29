import * as THREE from 'three';
import { box, cyl, ball, mat, mtx, alongDir, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildEmitter } from '../ParticleKit';
import { buildNeonSign } from '../NeonSign';
import { PULSE_PALETTE } from '../Discotron';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// PulseScenery — the five scenery pieces of the PULSE DISTRICT, a disco
// nightclub quarter. Per-world scenery (not an extension of the shared
// SceneryPack): one component folder exporting five pure imperative builders
// plus five composable components, so the whole club dressing set arrives (and
// versions) together — the same shape as components/BrassworkScenery,
// components/TidewaterScenery and components/EmberfallScenery.
//
//   1. <NeonArch>         a gateway arch on graphite posts: a chorded header
//                         truss, a real buildNeonSign marquee and a CROWN of
//                         concentric neon tube arches that chase on the beat
//   2. <SpeakerStack>     a touring PA stack on a wheeled dolly — ported bass
//                         bin, mid cabinet with a live VU ladder, horn flare
//                         top box, ratchet strap, cable coil
//   3. <MirrorBallPylon>  a tapering steel lattice mast carrying a faceted
//                         mirror ball on a motor drum, throwing rotating light
//                         shards down onto the ground
//   4. <LaserTruss>       a box-truss span on two A-frame legs with moving-head
//                         laser fixtures panning under it, beams punching on
//                         the downbeat through a low haze
//   5. <LightTiles>       a patch of light-up floor tiles, beat-synced to
//                         <DanceFloor> tile-for-tile plus a radial ripple
//
// THE BEAT IS THE POINT, AND IT IS SHARED. `BEAT_HZ = 2.2` is the SAME clock
// <DanceFloor> flashes its tiles to, <Discotron>'s mirror ball scintillates on
// and <Bassline>'s tunnel hoops chase to, driven by the same three helpers
// (`beatStep` / `beatPulse` / `beatKick` — re-declared here exactly as
// components/Bassline re-declares them, because they are module-private to
// Discotron). Every glowing surface in this file steps a PULSE_PALETTE colour
// once per beat and blooms on DanceFloor's own 0.55…1 curve, so a park that
// mixes these pieces with the floor, the coaster and the spinner reads as ONE
// place with one DJ.
//
// PALETTE: `PULSE_PALETTE` is IMPORTED from components/Discotron — never
// re-derived. It is the COOL subset of DanceFloor's DISCO_PALETTE (magenta /
// cyan / violet / blue); the floor's amber and lime were deliberately dropped
// because a mirror ball throwing amber shards read as a fairground carousel
// rather than a nightclub. The material greys live in the exported `PULSE`
// table below and are byte-identical to Discotron's, so a speaker stack parked
// beside the ride is the same graphite as the ride.
//
// TWO CLOCKS, like Discotron: the LIGHT SHOW runs on ABSOLUTE time (a club
// never stops, and a mirror ball never stops turning). Nothing in this pack is
// motion-gated because nothing here is a ride — but every updater takes
// absolute time and derives everything from it, so a throttled LOD frame gives
// coarser motion, never drifted motion.
//
// METALNESS: a MeshStandardMaterial at metalness ≥ 0.6 with no environment map
// renders NEAR-BLACK on this Stage (metals are lit only by reflections and
// there is nothing to reflect). Every metal here sits in the 0.22–0.35 band and
// gets its chrome from COLOUR plus the 'metal' canvas, never from metalness —
// the lesson Discotron's truss ring paid for when graphite at metal 0.3 went
// black against grass and the ring read as coaster track.
//
// DAYTIME READ is designed, not inherited: an unlit neon world in daylight must
// still read as a nightclub district and not as grey boxes. So the FORM carries
// every piece with no glow at all — concrete footings, chrome collars and
// kick rails, real woofer cones with dust caps and surrounds, a chorded box
// truss with visible webs, painted magenta/cyan chevrons and badge plates, and
// a SILVER faceted ball that reads as a mirror ball at noon. Emissives sit at
// ~12-20 % by day and ramp on `nightKOf`.
//
// Budgets: THREE real PointLights across all five pieces (the arch's marquee
// light inside buildNeonSign, the pylon's ball wash, the truss's centre
// downlight — all night-gated), 48 particles for a full set (the truss haze,
// and only when `haze` is on), static repeats batched through Stage's
// `mergedBoxes` / `mergedParts`, fine detail (rivets, LED nodes, castors, badge
// plates, tile kerb studs) tagged `userData.lodDetail`. Deterministic: hashed
// sines only, never Math.random / Date.now.
//
// TEXTURE SCALE ON SMALL PARTS — the warning all three sibling packs left
// behind. A 128² tile stretched over a 0.04 u tube puts its grain below one
// pixel at park zoom and the surface averages to a flat dark smear. Every
// `repeat` here is chosen against the part's real world size (roughly one tile
// per 0.25–0.5 u), and anything thinner than ~0.02 u (neon tubes, cable, LED
// nodes, straps) carries NO map at all.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

// ---------------------------------------------------------------------------
// THE DISTRICT BEAT — the one clock. Identical to <DanceFloor>'s tile clock,
// <Discotron>'s light show and <Bassline>'s hoop chase; the helpers are
// module-private in Discotron, so (exactly like Bassline) they are re-declared
// here rather than re-invented. Change these and the whole district drifts.
// ---------------------------------------------------------------------------
/** the district beat — the SAME rate <DanceFloor> flashes its tiles at */
export const BEAT_HZ = 2.2;
/** integer beat index (colours STEP once per beat) */
export const beatStep = (time: number, off = 0) => Math.floor(time * BEAT_HZ + off);
/** 0.55…1 bloom that DIPS exactly on the colour change (DanceFloor's curve) */
export const beatPulse = (time: number, ph = 0) => 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (time * BEAT_HZ + ph)));
/** sharp downbeat spike — 1 on the beat, decaying to ~0 across it */
export const beatKick = (time: number, ph = 0) => {
  const f = (((time * BEAT_HZ + ph) % 1) + 1) % 1;
  return Math.exp(-7 * f);
};
/** wrap-safe PULSE_PALETTE lookup (negative indices included) */
export const paletteAt = (i: number) =>
  PULSE_PALETTE[((i % PULSE_PALETTE.length) + PULSE_PALETTE.length) % PULSE_PALETTE.length];

// ---------------------------------------------------------------------------
// THE PULSE PALETTE — graphite, black gloss, chrome and concrete under
// magenta/cyan/violet neon. Every value is byte-identical to the one
// components/Discotron uses, so this pack, the spinner, the coaster and the
// stall are one material family (the way TidewaterScenery's TIDEWATER table
// serves the whole cove).
// ---------------------------------------------------------------------------
export const PULSE = {
  /** the world's default structure metal: cool graphite (posts, masts, cabinets) */
  graphite: 0x3a3d45,
  /** shadow-side graphite: bearings, cone surrounds, junction boxes, base flanges */
  graphiteDark: 0x2a2d34,
  /** black-gloss panelling — cabinet bodies, sign backs, counter faces */
  gloss: 0x16171c,
  /** the DECK grey: deliberately a shade off pure black so anything standing on
   *  it stays legible in daylight (Discotron's stage deck) */
  deck: 0x21232a,
  /** structural steel — trusses and lattice legs. Deliberately the LIGHTEST
   *  metal in the kit: graphite at metal 0.3 went near-black against grass and
   *  read as coaster track */
  steel: 0x6e737d,
  /** brushed chrome bands, rails, collars, clamps (metal ≤ 0.35) */
  chrome: 0xa6adb6,
  /** footings, ballast blocks, apron slabs */
  concrete: 0x9b9a96,
  /** mirror-ball facet tiles */
  mirror: 0xd9dbe3,
  /** district accent A — DISCO_PALETTE[0] */
  magenta: 0xd815b8,
  /** district accent B — DISCO_PALETTE[1] */
  cyan: 0x18c8d8,
  /** district accent C — the slot that replaced the floor's two warm colours */
  violet: 0x7b3fe4,
  /** FLIGHT-CASE charcoal — the textured black a touring cabinet is actually
   *  painted. Deliberately NOT `gloss`: a whole 1.15-u speaker stack built out
   *  of 0x16171c read as one black filing cabinet in the daylight harness, with
   *  the cones, the horn and the strap all invisible inside it. Reserve `gloss`
   *  for SMALL black-gloss panels sitting among lighter parts (Discotron's tub
   *  walls, a fixture housing) and use this for anything bigger than ~0.3 u. */
  caseBlack: 0x33363d,
  /** the BAFFLE — the recessed grille-cloth face a driver is mounted on, a
   *  clear step lighter than the case. This one value is most of the piece's
   *  daytime read: without it a cabinet is a solid black slab and the cones,
   *  the horn and the badge all vanish into it */
  baffle: 0x6b7079,
  /** speaker cone paper: near-black, pitched UP off pure black so a cone reads
   *  as a cone instead of a hole in the frame */
  cone: 0x22242a,
  /** the pale rubbed dome on a woofer's dust cap — the brightest point on a
   *  cabinet face, and what makes a driver read as a driver at park zoom */
  dustCap: 0x767c86,
  /** cast rubber — castor tyres, cable, feet */
  rubber: 0x1a1b1f,
} as const;

const {
  graphite: GRAPHITE,
  graphiteDark: GRAPHITE_D,
  gloss: GLOSS,
  deck: DECK,
  steel: STEEL,
  chrome: CHROME,
  concrete: CONCRETE,
  mirror: MIRROR,
  magenta: MAGENTA,
  cyan: CYAN,
  caseBlack: CASE,
  baffle: BAFFLE,
  cone: CONE,
  dustCap: DUSTCAP,
  rubber: RUBBER,
} = PULSE;

// ---- shared material recipes ----------------------------------------------
const METAL = { tex: 'metal' as const, metal: 0.3, rough: 0.44 };
const CHROMEY = { tex: 'metal' as const, metal: 0.32, rough: 0.3 };
const STEELY = { tex: 'metal' as const, metal: 0.22, rough: 0.38 };
const GLOSSY = { tex: 'plastic' as const, rough: 0.2 };
const CRETE = { tex: 'concrete' as const, rough: 0.94 };

/** an EMISSIVE lamp material — lit geometry that also glows (LED nodes, lenses,
 *  neon tubes, floor tiles). One per animated group, never one per lamp. */
const lamp = (t: typeof THREE, tint: number, emi = 0.2) =>
  new t.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: emi, roughness: 0.35 });

/** a PURE-LIGHT additive material — light, never lit geometry (beams, shards,
 *  halos, glow washes). Discotron's exact recipe: black base + emissive tint +
 *  AdditiveBlending + no depth write, so it can never be shaded by the sun. */
const additive = (t: typeof THREE, tint: number, emi: number, op: number) =>
  new t.MeshStandardMaterial({
    color: 0x000000,
    emissive: tint,
    emissiveIntensity: emi,
    transparent: true,
    opacity: op,
    depthWrite: false,
    blending: t.AdditiveBlending,
    side: t.DoubleSide,
    roughness: 1,
  });

/** clamp a caller's (or the seed sweep's) `count` into a piece's legal band */
const clampCount = (v: number | undefined, lo: number, hi: number, dflt: number) =>
  v == null ? dflt : Math.max(lo, Math.min(hi, Math.round(v)));

/** the five piece names, for set-piece authors and lint tables */
export type PulsePieceName = 'neonArch' | 'speakerStack' | 'mirrorBallPylon' | 'laserTruss' | 'lightTiles';
export const PULSE_PIECES: PulsePieceName[] = ['neonArch', 'speakerStack', 'mirrorBallPylon', 'laserTruss', 'lightTiles'];

// ===========================================================================
// 1. NEON ARCH — the district's gateway
// ===========================================================================
// A walk-under arch: two graphite box posts on concrete footings, a chorded
// header truss between them, a REAL `buildNeonSign` marquee bolted over the
// header (this piece BUILDS ON the shared sign builder rather than around it —
// the same call <Discotron> makes for its marquee) and above that a CROWN of
// concentric neon tube arches that fire one per beat, so the light visibly runs
// outward from the marquee. Two flood cans on the header aim down at the path,
// and an LED ladder chases up each post.
//
// CLEAR HEIGHT is the whole constraint: a 0.5-scale guest is ~0.55 tall, so the
// header's underside sits at 2.10 — head-and-balloon room with the arch still
// reading as a doorway rather than a football goal.
// ===========================================================================

export interface NeonArchOpts {
  /** marquee text (default 'PULSE') — anything buildNeonSign's font takes */
  text?: string;
  /** neon tube arches in the crown (default 5; clamped 1…8) */
  count?: number;
  /** deterministic variation seed (default 0) */
  seed?: number;
  /** half the span between post centres (default 1.15) */
  halfWidth?: number;
}

export interface NeonArchBuilt extends ComposableBuilt {
  update: (time: number) => void;
  /** half the span between post centres, for the blocker rects */
  halfWidth: number;
  /** post half-thickness (the solid part a guest must path around) */
  postHalf: number;
  /** overall height including the crown */
  height: number;
  /** underside of the header — the walk-through clearance */
  clearHeight: number;
}

export function buildNeonArch(t: typeof THREE, opts: NeonArchOpts = {}): NeonArchBuilt {
  const g = new t.Group();
  const seed = opts.seed ?? 0;
  const arcs = clampCount(opts.count, 1, 8, 5);
  const halfW = opts.halfWidth ?? 1.15;
  const POST = 0.16; // square post section
  const FOOT_H = 0.07;
  const HEAD_LOW = 2.1; // header underside = the clear height
  const HEAD_TOP = 2.36;
  const mats: THREE.MeshStandardMaterial[] = [];

  // ---- footings + posts ---------------------------------------------------
  const feet: PartSpec[] = [];
  const flanges: PartSpec[] = [];
  const collars: PartSpec[] = [];
  const posts: MergedBoxSpec[] = [];
  const chevrons: [MergedBoxSpec[], MergedBoxSpec[]] = [[], []];
  [-1, 1].forEach((s) => {
    const px = s * halfW;
    feet.push({ geo: new t.CylinderGeometry(0.23, 0.27, FOOT_H, 18), matrix: mtx(t, [px, FOOT_H / 2, 0]), uv: [3, 1] });
    flanges.push({ geo: new t.CylinderGeometry(0.14, 0.16, 0.05, 14), matrix: mtx(t, [px, FOOT_H + 0.025, 0]) });
    posts.push({ dims: [POST, HEAD_TOP - FOOT_H, POST], pos: [px, (HEAD_TOP + FOOT_H) / 2, 0], repeat: [1, 8] });
    [0.55, 1.15, 1.75].forEach((cy) =>
      collars.push({ geo: new t.CylinderGeometry(POST * 0.72, POST * 0.72, 0.05, 12), matrix: mtx(t, [px, cy, 0]) }),
    );
    // painted hazard chevrons at knee height — the daytime graphic, and the
    // reason the posts do not read as two black sticks at noon
    for (let i = 0; i < 4; i += 1) {
      chevrons[i % 2].push({ dims: [POST + 0.004, 0.055, POST + 0.004], pos: [px, 0.24 + i * 0.07, 0] });
    }
  });
  g.add(mergedParts(t, feet, mat(t, CONCRETE, CRETE)));
  g.add(mergedBoxes(t, posts, GRAPHITE, { ...METAL, repeat: [1, 1] }));
  g.add(mergedParts(t, flanges, mat(t, GRAPHITE_D, METAL)));
  g.add(mergedParts(t, collars, mat(t, CHROME, CHROMEY)));
  const chevA = mergedBoxes(t, chevrons[0], MAGENTA, { rough: 0.45 });
  const chevB = mergedBoxes(t, chevrons[1], CYAN, { rough: 0.45 });
  chevA.userData.lodDetail = true;
  chevB.userData.lodDetail = true;
  g.add(chevA, chevB);

  // ---- the header: a real chorded box truss, not a plank ------------------
  const span = halfW * 2 + POST + 0.14;
  const trussParts: MergedBoxSpec[] = [];
  trussParts.push({ dims: [span, 0.06, 0.13], pos: [0, HEAD_TOP - 0.03, 0], repeat: [8, 1] }); // upper chord
  trussParts.push({ dims: [span, 0.055, 0.12], pos: [0, HEAD_LOW + 0.028, 0], repeat: [8, 1] }); // lower chord
  const WEBS = Math.max(4, Math.round(span / 0.22));
  for (let k = 0; k < WEBS; k += 1) {
    trussParts.push({
      dims: [0.04, HEAD_TOP - HEAD_LOW - 0.06, 0.04],
      pos: [-span / 2 + 0.08 + (k * (span - 0.16)) / Math.max(1, WEBS - 1), (HEAD_TOP + HEAD_LOW) / 2, 0],
      rotZ: (k % 2 ? 1 : -1) * 0.5,
    });
  }
  g.add(mergedBoxes(t, trussParts, STEEL, { ...STEELY, repeat: [1, 1] }));

  // ---- the marquee: buildNeonSign, HUNG IN THE OPENING --------------------
  // It hangs UNDER the header on two rods, exactly the way <Discotron> hangs
  // its own marquee under the truss ring — not perched on top. The first cut sat
  // it above the header and the crown's inner arches ran straight across the
  // lettering; in the opening the sign is the arch's focal point, backed by its
  // own dark board, and the crown has the whole sky to itself. The sign's tube
  // baseline sits at 1.74 (board 1.695…2.085), so the walk-through clearance
  // under the marquee is 1.69 — three head-heights for a 0.55 guest.
  const SIGN_Y = 1.74;
  const sign = buildNeonSign(t, {
    text: opts.text ?? 'PULSE',
    color: MAGENTA,
    secondary: CYAN,
    scale: 0.2,
    backboard: true,
  });
  sign.group.position.set(0, SIGN_Y, 0.02);
  g.add(sign.group);
  const signTop = SIGN_Y + 1.5 * 0.2 + 0.045; // backboard top edge
  const brk: PartSpec[] = [];
  [-1, 1].forEach((s) =>
    brk.push({
      geo: new t.CylinderGeometry(0.016, 0.016, HEAD_LOW - signTop + 0.03, 6),
      matrix: mtx(t, [s * Math.min(0.42, sign.width / 2), (HEAD_LOW + signTop) / 2, -0.005]),
    }),
  );
  const brkMesh = mergedParts(t, brk, mat(t, CHROME, CHROMEY));
  brkMesh.userData.lodDetail = true;
  g.add(brkMesh);
  // A CHROME PICTURE FRAME round the sign's own backboard. `buildNeonSign`'s
  // board is 0x1d1e22 and the tubes only glow at ~12 % by day, so unframed the
  // marquee read as a black rectangle hanging in the arch at noon. The frame is
  // this pack's job, not NeonSign's — the sign builder is used as-is.
  {
    const bw = sign.width + 2 * 0.15 * 1.5 * 0.2;
    const bh = 1.5 * 0.2 + 2 * 0.15 * 1.5 * 0.2;
    const midY = SIGN_Y + 0.75 * 0.2;
    const frame: MergedBoxSpec[] = [];
    [-1, 1].forEach((s) => frame.push({ dims: [bw + 0.05, 0.028, 0.05], pos: [0, midY + s * (bh / 2 + 0.014), -0.002] }));
    [-1, 1].forEach((s) => frame.push({ dims: [0.028, bh + 0.056, 0.05], pos: [s * (bw / 2 + 0.014), midY, -0.002] }));
    g.add(mergedBoxes(t, frame, CHROME, CHROMEY));
  }

  // ---- the CROWN: concentric neon tube arches, one material per arch ------
  // Each arch is a half-ellipse of short box segments merged into ONE mesh, so
  // an 8-arch crown costs 8 draw calls and 8 animated materials. They fire in
  // SEQUENCE, one per beat, so the light runs outward from the marquee.
  const crownMats: THREE.MeshStandardMaterial[] = [];
  const CROWN_BASE = HEAD_TOP + 0.01;
  let crownTop = CROWN_BASE;
  for (let a = 0; a < arcs; a += 1) {
    const aw = 0.44 + (a * (halfW - 0.44 + 0.06)) / Math.max(1, arcs - 1 || 1);
    const rise = 0.3 + a * 0.13;
    crownTop = Math.max(crownTop, CROWN_BASE + rise);
    const SEG = 14;
    const parts: PartSpec[] = [];
    for (let i = 0; i < SEG; i += 1) {
      const th0 = (i / SEG) * Math.PI;
      const th1 = ((i + 1) / SEG) * Math.PI;
      const x0 = aw * Math.cos(th0);
      const y0 = CROWN_BASE + rise * Math.sin(th0);
      const x1 = aw * Math.cos(th1);
      const y1 = CROWN_BASE + rise * Math.sin(th1);
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.012;
      parts.push({
        geo: new t.BoxGeometry(len, 0.038, 0.038),
        matrix: mtx(t, [(x0 + x1) / 2, (y0 + y1) / 2, 0], [0, 0, Math.atan2(y1 - y0, x1 - x0)]),
      });
    }
    const m = lamp(t, paletteAt(a), 0.2);
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    g.add(mesh);
    crownMats.push(m);
    mats.push(m);
    // the arch feet land on the header top — a chrome shoe at each so the tube
    // is MOUNTED rather than levitating (the NeonSign stand-off-pin lesson)
    const shoes: PartSpec[] = [-1, 1].map((s) => ({
      geo: new t.CylinderGeometry(0.03, 0.036, 0.05, 8),
      matrix: mtx(t, [s * aw, CROWN_BASE - 0.015, 0]),
    }));
    const shoeMesh = mergedParts(t, shoes, mat(t, CHROME, CHROMEY));
    shoeMesh.userData.lodDetail = true;
    g.add(shoeMesh);
  }

  // ---- flood cans on the header, aimed down at the path -------------------
  const canLens: THREE.MeshStandardMaterial = lamp(t, paletteAt(1), 0.18);
  mats.push(canLens);
  const lensParts: PartSpec[] = [];
  [-(halfW - 0.28), halfW - 0.28].forEach((cx, i) => {
    const yaw = (hash01(seed * 3.1 + i * 7.7) - 0.5) * 0.5;
    g.add(cyl(t, 0.075, 0.09, 0.16, GRAPHITE_D, [cx, HEAD_LOW - 0.06, 0], { ...METAL, seg: 12, rotZ: yaw }));
    g.add(box(t, [0.12, 0.05, 0.05], CHROME, [cx, HEAD_LOW + 0.03, 0], CHROMEY)); // yoke clamp
    lensParts.push({ geo: new t.CylinderGeometry(0.062, 0.062, 0.02, 12), matrix: mtx(t, [cx, HEAD_LOW - 0.14, 0], [0, 0, yaw]) });
  });
  const lensMesh = mergedParts(t, lensParts, canLens);
  lensMesh.castShadow = false;
  g.add(lensMesh);

  // ---- LED ladders chasing UP each post (2 alternating groups) ------------
  const ladderMats: THREE.MeshStandardMaterial[] = [];
  for (let grp = 0; grp < 2; grp += 1) {
    const parts: PartSpec[] = [];
    for (let i = grp; i < 14; i += 2) {
      const y = 0.66 + i * 0.1;
      [-1, 1].forEach((s) =>
        parts.push({ geo: new t.BoxGeometry(0.035, 0.05, 0.035), matrix: mtx(t, [s * (halfW + POST / 2 + 0.014), y, 0]) }),
      );
    }
    const m = lamp(t, paletteAt(grp + 1), 0.18);
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    mesh.userData.lodDetail = true;
    g.add(mesh);
    ladderMats.push(m);
    mats.push(m);
  }

  // ---- a graphite control box + conduit on the left post ------------------
  g.add(box(t, [0.2, 0.26, 0.13], GRAPHITE_D, [-halfW - POST / 2 - 0.08, 0.5, 0.02], { ...METAL, repeat: [2, 2] }));
  g.add(box(t, [0.13, 0.02, 0.09], CHROME, [-halfW - POST / 2 - 0.08, 0.64, 0.055], CHROMEY));
  g.add(cyl(t, 0.02, 0.02, 0.42, RUBBER, [-halfW - POST / 2 - 0.08, 0.24, 0.02], { rough: 0.8, seg: 8 })); // conduit down to grade

  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    // the crown fires OUTWARD: arch a lights on beat (step - a), so the pulse
    // visibly runs from the marquee to the outermost tube
    crownMats.forEach((m, i) => {
      const on = ((step - i) % Math.max(1, crownMats.length) + crownMats.length) % Math.max(1, crownMats.length) === 0;
      const col = paletteAt(step + i);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (on ? 0.35 + 1.85 * gain : 0.12 + 0.28 * gain) * beatPulse(time, i * 0.07);
    });
    // post ladders alternate on the beat, with a hashed shimmer
    ladderMats.forEach((m, i) => {
      const on = ((step % 2) + 2) % 2 === i;
      const col = paletteAt(step + i * 2);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (on ? 0.3 + 1.5 * gain : 0.12 + 0.2 * gain) * (0.9 + 0.1 * Math.sin(time * 2.3 + i));
    });
    canLens.emissive.setHex(paletteAt(step + 1));
    canLens.emissiveIntensity = 0.18 + gain * (0.4 + 1.4 * beatKick(time, 0.5));
    sign.update(time);
  };

  return {
    group: g,
    update,
    halfWidth: halfW,
    postHalf: POST / 2 + 0.06,
    height: crownTop,
    clearHeight: SIGN_Y - 0.045, // under the hung marquee, not under the header
  };
}

// ===========================================================================
// 2. SPEAKER STACK — a touring PA stack on a wheeled dolly
// ===========================================================================
// Discotron already has speaker stacks: single 0.98-tall gloss cabinets with
// inset woofer cones and a tweeter, bolted to the stage. This is the SAME
// register and deliberately NOT that object — it is the hired-in touring rig
// that got wheeled into the district and left there: a castored dolly, a ported
// BASS BIN, a mid cabinet with a live VU LADDER, a horn-flare top box canted
// down at the crowd, a ratchet strap holding the stack together and a coil of
// cable on the deck. It stacks 1-4 boxes (`count`), so a park can put a lone
// bass bin against a wall and a full triple stack beside the arch.
// ===========================================================================

export interface SpeakerStackOpts {
  /** cabinets in the stack, bottom-up (default 3; clamped 1…4) */
  count?: number;
  /** deterministic variation seed (default 0) */
  seed?: number;
}

export interface SpeakerStackBuilt extends ComposableBuilt {
  update: (time: number) => void;
  /** blocker radius over the dolly + cabinets */
  radius: number;
  /** overall height of the stack as built */
  height: number;
}

export function buildSpeakerStack(t: typeof THREE, opts: SpeakerStackOpts = {}): SpeakerStackBuilt {
  const g = new t.Group();
  const seed = opts.seed ?? 0;
  const n = clampCount(opts.count, 1, 4, 3);

  const caseBoxes: MergedBoxSpec[] = [];
  const baffleBoxes: MergedBoxSpec[] = [];
  const graphiteBoxes: MergedBoxSpec[] = [];
  const chromeBoxes: MergedBoxSpec[] = [];
  const steelBoxes: MergedBoxSpec[] = [];
  const darkParts: PartSpec[] = [];
  const chromeParts: PartSpec[] = [];
  const badgeA: MergedBoxSpec[] = [];
  const badgeB: MergedBoxSpec[] = [];
  const wooferGroups: THREE.Group[] = [];
  const cylGeo = (rt: number, rb: number, h: number, seg: number) => new t.CylinderGeometry(rt, rb, h, seg);

  // ---- the dolly: a black ply deck on four castors ------------------------
  const DOLLY_Y = 0.055;
  graphiteBoxes.push({ dims: [0.66, 0.04, 0.56], pos: [0, DOLLY_Y + 0.02, 0], repeat: [3, 3] });
  ([
    [-0.26, -0.21],
    [0.26, -0.21],
    [-0.26, 0.21],
    [0.26, 0.21],
  ] as [number, number][]).forEach(([cx, cz]) => {
    darkParts.push({ geo: cylGeo(0.052, 0.052, 0.035, 12), matrix: mtx(t, [cx, 0.052, cz], [0, 0, Math.PI / 2]) }); // tyre
    chromeParts.push({ geo: cylGeo(0.022, 0.022, 0.04, 8), matrix: mtx(t, [cx, 0.052, cz], [0, 0, Math.PI / 2]) }); // hub
    chromeParts.push({ geo: cylGeo(0.018, 0.022, 0.05, 8), matrix: mtx(t, [cx, 0.098, cz]) }); // swivel stem
  });

  // ---- the cabinets, bottom-up -------------------------------------------
  // Each entry is [width, depth, height, kind]; the stack is truncated to `n`.
  // The widths TAPER on purpose: four same-width boxes read as one tall filing
  // cabinet from the park camera (the first pass did exactly that), and every
  // real PA stack narrows as it goes up.
  const CABS: [number, number, number, 'bass' | 'mid' | 'horn' | 'sub'][] = [
    [0.64, 0.54, 0.44, 'bass'],
    [0.54, 0.46, 0.32, 'mid'],
    [0.46, 0.4, 0.25, 'horn'],
    [0.38, 0.34, 0.2, 'sub'],
  ];
  let y = DOLLY_Y + 0.04;
  const vuMats: THREE.MeshStandardMaterial[] = [];
  const hornMat = lamp(t, paletteAt(2), 0.14);
  /** ONE thin dark bar across a driver — a bar guard, not a cage.
   *  THE LINEWORK LESSON, in two rounds. Pass 1 drew a full five-bar louvred
   *  STEEL grille over the whole baffle: it hid the cones and the stack read as
   *  caged shelving. Pass 2 kept three bars plus a bright CHROME surround torus
   *  per driver and the greys still won — at park zoom the rings read as
   *  handles and every cabinet turned into industrial racking. A speaker reads
   *  from THREE things and they are all tonal, not linear: a lighter baffle
   *  panel, a dark cone recess, and a PALE dust cap standing proud of it. */
  const guard = (cx: number, cyy: number, cz: number, r: number) => {
    steelBoxes.push({ dims: [r * 1.9, 0.011, 0.009], pos: [cx, cyy, cz] });
  };
  for (let i = 0; i < n; i += 1) {
    const [w, d, h, kind] = CABS[i];
    const cy = y + h / 2;
    const front = d / 2;
    caseBoxes.push({ dims: [w, h, d], pos: [0, cy, 0], repeat: [3, 3] });
    // the BAFFLE — a recessed grille-cloth face a step lighter than the case,
    // inset from the cabinet edges. This is most of the piece's daytime read
    // (see PULSE.baffle): on a solid black slab every driver disappeared.
    baffleBoxes.push({ dims: [w - 0.1, h - 0.1, 0.03], pos: [0, cy, front - 0.002], repeat: [2, 2] });
    // ONE chrome edge rail along the top front of each cabinet: enough to make
    // the stack read as separate flight cases, cheap enough not to add to the
    // grey. (Pass 2 ran the rail round all four edges AND put four corner
    // protectors on every box — see `guard` above for why that lost.)
    chromeBoxes.push({ dims: [w + 0.012, 0.022, 0.022], pos: [0, y + h - 0.012, d / 2] });
    // recessed carry handles on both flanks
    [-1, 1].forEach((sx) => chromeBoxes.push({ dims: [0.02, 0.03, 0.14], pos: [sx * (w / 2 + 0.006), cy + h * 0.08, 0] }));
    // a badge plate, alternating district accents — the cabinet's one colour
    (i % 2 ? badgeB : badgeA).push({ dims: [w * 0.5, 0.036, 0.024], pos: [0, y + h - 0.062, front + 0.008] });
    // REAR connector panel: a recessed plate with two chrome sockets and a
    // handle. The alternate-angle render showed the back of the stack as four
    // featureless black slabs; a patch panel is the one thing that is always
    // there on the back of a cabinet.
    graphiteBoxes.push({ dims: [w * 0.5, h * 0.34, 0.02], pos: [0, cy - h * 0.1, -front - 0.002], repeat: [2, 1] });
    [-1, 1].forEach((sx) =>
      chromeParts.push({ geo: cylGeo(0.022, 0.022, 0.02, 10), matrix: mtx(t, [sx * w * 0.13, cy - h * 0.1, -front - 0.014], [Math.PI / 2, 0, 0]) }),
    );

    if (kind === 'bass' || kind === 'sub') {
      // ported bass bin: cones side by side over a slot port, behind a grille
      const wf = new t.Group();
      g.add(wf);
      wooferGroups.push(wf);
      const cones: PartSpec[] = [];
      const caps: PartSpec[] = [];
      const rings: PartSpec[] = [];
      const rr = kind === 'bass' ? 0.145 : 0.135;
      const xs = kind === 'bass' ? [-0.15, 0.15] : [0];
      xs.forEach((wx) => {
        cones.push({ geo: cylGeo(rr, rr * 0.5, 0.08, 18), matrix: mtx(t, [wx, cy + 0.045, front - 0.026], [Math.PI / 2, 0, 0]) });
        rings.push({ geo: new t.TorusGeometry(rr * 1.04, 0.014, 6, 20), matrix: mtx(t, [wx, cy + 0.045, front + 0.006]) }); // dark rubber surround
        caps.push({ geo: new t.SphereGeometry(rr * 0.34, 10, 8), matrix: mtx(t, [wx, cy + 0.045, front + 0.004]) }); // dust cap, PROUD of the baffle
        guard(wx, cy + 0.045, front + 0.03, rr);
      });
      wf.add(mergedParts(t, cones, mat(t, CONE, { rough: 0.88 })));
      wf.add(mergedParts(t, caps, mat(t, DUSTCAP, { rough: 0.42, metal: 0.3 })));
      wf.add(mergedParts(t, rings, mat(t, GRAPHITE_D, { rough: 0.9 })));
      // the slot port under the cones — a bass bin without a port is a box
      graphiteBoxes.push({ dims: [w * 0.62, 0.055, 0.05], pos: [0, y + 0.075, front - 0.02], repeat: [3, 1] });
      chromeBoxes.push({ dims: [w * 0.64, 0.018, 0.018], pos: [0, y + 0.103, front + 0.002] });
    } else if (kind === 'mid') {
      // one mid cone + a compression-driver horn + the live VU ladder
      const wf = new t.Group();
      g.add(wf);
      wooferGroups.push(wf);
      const cones: PartSpec[] = [
        { geo: cylGeo(0.105, 0.055, 0.06, 16), matrix: mtx(t, [-0.125, cy + 0.03, front - 0.026], [Math.PI / 2, 0, 0]) },
      ];
      wf.add(mergedParts(t, cones, mat(t, CONE, { rough: 0.88 })));
      wf.add(ball(t, 0.036, DUSTCAP, [-0.125, cy + 0.03, front + 0.004], { rough: 0.42, metal: 0.3 }));
      const midRing = new t.Mesh(new t.TorusGeometry(0.11, 0.013, 6, 18), mat(t, GRAPHITE_D, { rough: 0.9 }));
      midRing.position.set(-0.125, cy + 0.03, front + 0.006);
      wf.add(midRing);
      guard(-0.125, cy + 0.03, front + 0.03, 0.105);
      // horn throat: a shallow truncated pyramid (CylinderGeometry, 4 sides) in
      // a chrome mouth flange, so the flare reads at noon and not only lit
      const throat = new t.Mesh(cylGeo(0.085, 0.03, 0.08, 4), hornMat);
      throat.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      throat.position.set(0.125, cy + 0.03, front - 0.028);
      throat.castShadow = false;
      g.add(throat);
      [-1, 1].forEach((sx) => chromeBoxes.push({ dims: [0.016, 0.2, 0.02], pos: [0.125 + sx * 0.1, cy + 0.03, front + 0.006] }));
      [-1, 1].forEach((sy) => chromeBoxes.push({ dims: [0.216, 0.016, 0.02], pos: [0.125, cy + 0.03 + sy * 0.1, front + 0.006] }));
      darkParts.push({ geo: new t.BoxGeometry(0.2, 0.19, 0.02), matrix: mtx(t, [0.125, cy + 0.03, front - 0.07]) }); // horn back plate
      // VU LADDER — 6 rungs in 6 materials, lit bottom-up off the beat bloom.
      // This is the piece's "live" tell at park zoom: a meter that MOVES.
      for (let r = 0; r < 6; r += 1) {
        const m = lamp(t, r > 3 ? MAGENTA : r > 1 ? paletteAt(1) : paletteAt(3), 0.16);
        const rung = new t.Mesh(new t.BoxGeometry(0.1, 0.02, 0.012), m);
        rung.position.set(0, cy - 0.115 + r * 0.028, front + 0.006);
        rung.castShadow = false;
        rung.userData.lodDetail = true;
        g.add(rung);
        vuMats.push(m);
      }
    } else {
      // horn-flare top box: a 2×2 array of flares in chrome mouth rings. The
      // first pass CANTED the whole group 0.2 rad and propped it on a wedge,
      // but the cabinet body itself is not rotated, so the wedge implied a tilt
      // that never happened — the flares alone carry the aim now.
      const flare = new t.Group();
      flare.position.set(0, cy, 0);
      g.add(flare);
      const flares: PartSpec[] = [];
      const mouths: PartSpec[] = [];
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sy) => {
          flares.push({
            geo: cylGeo(0.052, 0.018, 0.05, 4),
            matrix: mtx(t, [sx * 0.1, sy * 0.052, front - 0.026], [Math.PI / 2, Math.PI / 4, 0]),
          });
          mouths.push({
            geo: new t.TorusGeometry(0.062, 0.009, 4, 4),
            matrix: mtx(t, [sx * 0.1, sy * 0.052, front - 0.002], [0, 0, Math.PI / 4]),
          });
        });
      });
      const flareMesh = mergedParts(t, flares, hornMat);
      flareMesh.castShadow = false;
      flare.add(flareMesh);
      flare.add(mergedParts(t, mouths, mat(t, CHROME, CHROMEY))); // chrome mouth rings
      flare.add(box(t, [w * 0.86, 0.2, 0.02], GRAPHITE_D, [0, 0, front - 0.056], { ...METAL, repeat: [2, 1] }));
    }
    y += h;
  }
  const HEIGHT = y;

  // ---- the ratchet strap over the TOP cabinet ----------------------------
  // It hugs the top box only. A full-height strap at a fixed x/z (the first
  // pass) ran THROUGH the cabinet bodies, because the widths and depths taper —
  // there is no single line that hugs every box in the stack.
  if (n > 1) {
    const [tw, td, th] = CABS[n - 1];
    const y0 = HEIGHT - th - 0.02;
    [-1, 1].forEach((sx) =>
      chromeBoxes.push({ dims: [0.022, HEIGHT - y0 + 0.012, 0.06], pos: [sx * (tw / 2 + 0.014), (HEIGHT + y0) / 2, 0] }),
    );
    chromeBoxes.push({ dims: [tw + 0.06, 0.022, 0.06], pos: [0, HEIGHT + 0.015, 0] });
    darkParts.push({ geo: new t.BoxGeometry(0.07, 0.085, 0.05), matrix: mtx(t, [tw / 2 + 0.02, y0 + th * 0.4, td / 2 - 0.04]) }); // ratchet body
    chromeParts.push({ geo: cylGeo(0.011, 0.011, 0.095, 6), matrix: mtx(t, [tw / 2 + 0.02, y0 + th * 0.4 + 0.05, td / 2], [0, 0, 0.6]) }); // handle
  }

  // ---- an under-cabinet LED strip on the dolly's front edge --------------
  // The stack's NIGHT presence. Without it the piece vanished after dark in the
  // group render — a black cabinet with nothing but a 0.1-u VU ladder on it is
  // invisible next to a mirror ball, and adding a PointLight per stack would
  // blow the pack's ≤4-light budget three times over.
  const stripMat = lamp(t, paletteAt(0), 0.2);
  const strip = new t.Mesh(new t.BoxGeometry(0.58, 0.026, 0.022), stripMat);
  strip.position.set(0, DOLLY_Y + 0.028, 0.29);
  strip.castShadow = false;
  g.add(strip);

  // ---- cable coil + plug on the deck ------------------------------------
  const coil = new t.Mesh(new t.TorusGeometry(0.1, 0.017, 7, 16), mat(t, RUBBER, { rough: 0.85 }));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-0.02, DOLLY_Y + 0.06, -0.34);
  coil.userData.lodDetail = true;
  g.add(coil);
  const coil2 = new t.Mesh(new t.TorusGeometry(0.072, 0.015, 7, 14), mat(t, RUBBER, { rough: 0.85 }));
  coil2.rotation.x = Math.PI / 2;
  coil2.position.set(-0.02, DOLLY_Y + 0.09, -0.34);
  coil2.userData.lodDetail = true;
  g.add(coil2);
  darkParts.push({ geo: new t.BoxGeometry(0.06, 0.05, 0.075), matrix: mtx(t, [0.1, DOLLY_Y + 0.07, -0.36], [0, hash01(seed * 5.3) * 1.2, 0]) });

  // ---- flush the batches ------------------------------------------------
  g.add(mergedBoxes(t, caseBoxes, CASE, { tex: 'plastic', rough: 0.42, bump: 0.02, repeat: [1, 1] }));
  g.add(mergedBoxes(t, baffleBoxes, BAFFLE, { tex: 'fabric', rough: 0.9, bump: 0.03, repeat: [1, 1] }));
  g.add(mergedBoxes(t, graphiteBoxes, GRAPHITE, { ...METAL, repeat: [1, 1] }));
  g.add(mergedBoxes(t, chromeBoxes, CHROME, CHROMEY));
  const grilleMesh = mergedBoxes(t, steelBoxes, STEEL, { ...STEELY, repeat: [1, 1] });
  grilleMesh.castShadow = false;
  g.add(grilleMesh);
  g.add(mergedParts(t, darkParts, mat(t, GRAPHITE_D, METAL)));
  const chromeMesh = mergedParts(t, chromeParts, mat(t, CHROME, CHROMEY));
  chromeMesh.userData.lodDetail = true;
  g.add(chromeMesh);
  const bA = mergedBoxes(t, badgeA, MAGENTA, { rough: 0.45 });
  const bB = mergedBoxes(t, badgeB, CYAN, { rough: 0.45 });
  bA.userData.lodDetail = true;
  bB.userData.lodDetail = true;
  g.add(bA, bB);

  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    const kick = beatKick(time);
    // the cones THUMP forward on every beat (the cabinet stays put)
    wooferGroups.forEach((wf, i) => {
      wf.position.z = 0.018 * beatKick(time, i * 0.04) - 0.004;
    });
    // the VU ladder climbs with the beat bloom: rung r lights while the level
    // is above it, so the meter visibly rides the music instead of blinking
    const level = (0.35 + 0.65 * beatPulse(time, 0.1)) * (0.72 + 0.28 * kick);
    vuMats.forEach((m, r) => {
      const on = level > (r + 0.5) / vuMats.length;
      m.emissiveIntensity = (on ? 0.3 + 1.9 * gain : 0.1 + 0.12 * gain) * (0.92 + 0.08 * Math.sin(time * 7 + r));
    });
    hornMat.emissive.setHex(paletteAt(step + 2));
    hornMat.emissiveIntensity = 0.12 + gain * 0.45 * beatPulse(time, 0.4);
    const col = paletteAt(step);
    stripMat.color.setHex(col);
    stripMat.emissive.setHex(col);
    stripMat.emissiveIntensity = 0.18 + gain * 1.15 * beatPulse(time, 0.2);
  };

  return { group: g, update, radius: 0.42, height: HEIGHT };
}

// ===========================================================================
// 3. MIRROR-BALL PYLON — a faceted ball up a lattice mast
// ===========================================================================
// A tapering four-leg steel lattice mast on a concrete pad, chorded and
// cross-braced at six levels, topped by a motor drum and a faceted MIRROR BALL
// on a chrome spindle. The ball turns on the absolute clock (a mirror ball
// never stops) and throws `count` rotating LIGHT SHARDS — tapered additive
// shafts, each with an elongated floor patch where it lands — down onto the
// ground around the mast, so the piece animates the PATH and not just itself.
//
// The ball is Discotron's recipe at pylon scale: a dark seam core plus mirror
// tiles on a Fibonacci sphere split into shells that scintillate on hashed beat
// offsets, with the tint pulled halfway to white — at full palette saturation
// the shells turn the ball into a rainbow beach ball, where a mirror ball is
// silver glass CATCHING a colour. 64 tiles in 3 shells, so the whole ball is
// 3 draw calls + core + halo.
// ===========================================================================

export interface MirrorBallPylonOpts {
  /** rotating light shards thrown off the ball (default 6; clamped 3…8) */
  count?: number;
  /** deterministic variation seed (default 0) */
  seed?: number;
  /** mast height to the motor drum (default 2.3) */
  height?: number;
}

export interface MirrorBallPylonBuilt extends ComposableBuilt {
  update: (time: number) => void;
  /** blocker radius over the pad + mast */
  radius: number;
  /** overall height including the ball */
  height: number;
  /** ball centre height, for aiming other pieces at it */
  ballY: number;
}

export function buildMirrorBallPylon(t: typeof THREE, opts: MirrorBallPylonOpts = {}): MirrorBallPylonBuilt {
  const g = new t.Group();
  const seed = opts.seed ?? 0;
  const shards = clampCount(opts.count, 3, 8, 6);
  const MAST = Math.max(1.4, opts.height ?? 2.3);
  const BALL_R = 0.3;
  const BALL_Y = MAST + 0.16 + BALL_R + 0.06;
  const PAD = 0.34; // pad half-extent
  const BASE_R = 0.22; // leg spread at grade
  const TOP_R = 0.1; // leg spread at the drum

  // ---- pad + base flanges ------------------------------------------------
  g.add(box(t, [PAD * 2, 0.08, PAD * 2], CONCRETE, [0, 0.04, 0], { ...CRETE, repeat: [3, 3] }));
  g.add(box(t, [PAD * 2 + 0.05, 0.02, PAD * 2 + 0.05], GRAPHITE_D, [0, 0.09, 0], { rough: 0.6 }));

  // ---- the lattice mast: 4 tapering legs, chords + zigzag braces ---------
  const CORNERS: [number, number][] = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  const LEVELS = 6;
  const rAt = (u: number) => BASE_R + (TOP_R - BASE_R) * u;
  const legParts: PartSpec[] = [];
  const braceParts: MergedBoxSpec[] = [];
  const legGeo = new t.CylinderGeometry(0.032, 0.038, 1, 8);
  CORNERS.forEach(([sx, sz]) => {
    const a = new t.Vector3(sx * BASE_R, 0.1, sz * BASE_R);
    const b = new t.Vector3(sx * TOP_R, MAST, sz * TOP_R);
    const d = new t.Vector3().subVectors(b, a);
    legParts.push({ geo: legGeo, matrix: alongDir(t, a, d, d.length()).scale(new t.Vector3(1, d.length(), 1)), uv: [1, 8] });
  });
  // horizontal chords + diagonals at every level
  for (let lv = 0; lv <= LEVELS; lv += 1) {
    const u = lv / LEVELS;
    const y = 0.1 + u * (MAST - 0.1);
    const r = rAt(u);
    for (let c = 0; c < 4; c += 1) {
      const [ax, az] = CORNERS[c];
      const [bx, bz] = CORNERS[(c + 1) % 4];
      const p0 = [ax * r, az * r] as [number, number];
      const p1 = [bx * r, bz * r] as [number, number];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      braceParts.push({
        dims: [0.026, 0.026, len],
        pos: [(p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2],
        rotY: Math.atan2(p1[0] - p0[0], p1[1] - p0[1]),
      });
      // one diagonal per bay per level (alternating hand, so the mast reads
      // as a braced lattice and not as a stack of hoops)
      if (lv < LEVELS) {
        const u2 = (lv + 1) / LEVELS;
        const y2 = 0.1 + u2 * (MAST - 0.1);
        const r2 = rAt(u2);
        const q0 = lv % 2 ? p0 : p1;
        const q1x = (lv % 2 ? bx : ax) * r2;
        const q1z = (lv % 2 ? bz : az) * r2;
        const dx = q1x - q0[0];
        const dy = y2 - y;
        const dz = q1z - q0[1];
        const dl = Math.hypot(dx, dy, dz);
        braceParts.push({
          dims: [0.02, 0.02, dl],
          matrix: mtx(t, [(q0[0] + q1x) / 2, (y + y2) / 2, (q0[1] + q1z) / 2], [
            -Math.asin(Math.max(-1, Math.min(1, dy / Math.max(1e-6, dl)))),
            Math.atan2(dx, dz),
            0,
          ]),
        });
      }
    }
  }
  g.add(mergedParts(t, legParts, mat(t, STEEL, STEELY), false));
  legGeo.dispose();
  const braceMesh = mergedBoxes(t, braceParts, STEEL, { ...STEELY, repeat: [1, 1] });
  g.add(braceMesh);
  // painted HAZARD COLLARS round the bottom bay — the daytime graphic. The
  // first pass ran full-width painted bars across the mast and they read as a
  // neon X floating inside the lattice; a collar is four short chord-parallel
  // bands hugging the outside of the legs, which reads as paint on steel.
  const chevA: MergedBoxSpec[] = [];
  const chevB: MergedBoxSpec[] = [];
  for (let i = 0; i < 5; i += 1) {
    const cyy = 0.2 + i * 0.075;
    const r = rAt((cyy - 0.1) / (MAST - 0.1)) + 0.008;
    const bin = i % 2 ? chevB : chevA;
    for (let c = 0; c < 4; c += 1) {
      const [ax, az] = CORNERS[c];
      const [bx, bz] = CORNERS[(c + 1) % 4];
      const p0: [number, number] = [ax * r, az * r];
      const p1: [number, number] = [bx * r, bz * r];
      bin.push({
        dims: [0.032, 0.05, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 0.9],
        pos: [(p0[0] + p1[0]) / 2, cyy, (p0[1] + p1[1]) / 2],
        rotY: Math.atan2(p1[0] - p0[0], p1[1] - p0[1]),
      });
    }
  }
  const cA = mergedBoxes(t, chevA, MAGENTA, { rough: 0.45 });
  const cB = mergedBoxes(t, chevB, CYAN, { rough: 0.45 });
  cA.userData.lodDetail = true;
  cB.userData.lodDetail = true;
  g.add(cA, cB);
  // a junction box + conduit at the foot
  g.add(box(t, [0.17, 0.2, 0.11], GRAPHITE_D, [PAD - 0.02, 0.2, -PAD + 0.06], { ...METAL, repeat: [2, 2] }));
  g.add(cyl(t, 0.017, 0.017, 0.9, RUBBER, [BASE_R * 0.75, 0.55, -BASE_R * 0.75], { rough: 0.8, seg: 8 }));

  // ---- motor drum + spindle ---------------------------------------------
  g.add(cyl(t, 0.14, 0.15, 0.16, GRAPHITE, [0, MAST + 0.08, 0], { ...METAL, repeat: [4, 1], seg: 16 }));
  g.add(cyl(t, 0.155, 0.155, 0.035, CHROME, [0, MAST + 0.17, 0], { ...CHROMEY, seg: 16 }));
  g.add(cyl(t, 0.024, 0.024, 0.14, CHROME, [0, MAST + 0.25, 0], { ...CHROMEY, seg: 8 }));

  // ---- the mirror ball ---------------------------------------------------
  const ballRig = new t.Group();
  ballRig.position.set(0, BALL_Y, 0);
  g.add(ballRig);
  ballRig.add(ball(t, BALL_R - 0.025, 0x33363e, [0, 0, 0], { flat: true, rough: 0.55, metal: 0.2 })); // seam core
  const facetMats: THREE.MeshStandardMaterial[] = [];
  // 81 tiles over 3 shells at 0.14 across ≈ 140 % coverage on an r-0.30 sphere.
  // The first pass used 64 at 0.135 (≈ 100 %) and the Fibonacci spiral left
  // visible dark gaps between plates, so the ball read as a spotty grey sphere
  // in daylight — Discotron's 128-tile lesson at pylon scale.
  const TILES = 81;
  const SHELLS = 3;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const tileGeo = new t.BoxGeometry(0.14, 0.14, 0.012);
  for (let shell = 0; shell < SHELLS; shell += 1) {
    const parts: PartSpec[] = [];
    for (let i = shell; i < TILES; i += SHELLS) {
      const yy = 1 - (2 * (i + 0.5)) / TILES;
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      const a = GOLDEN * i;
      const nrm = new t.Vector3(Math.cos(a) * rr, yy, Math.sin(a) * rr).normalize();
      const t1 = new t.Vector3(0, 1, 0).cross(nrm);
      if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new t.Vector3().crossVectors(nrm, t1).normalize();
      parts.push({
        geo: tileGeo,
        matrix: new t.Matrix4().makeBasis(t1, t2, nrm).setPosition(nrm.clone().multiplyScalar(BALL_R - 0.006)),
      });
    }
    const m = new t.MeshStandardMaterial({
      color: MIRROR,
      emissive: paletteAt(shell),
      emissiveIntensity: 0.12,
      roughness: 0.14,
      metalness: 0.28,
      flatShading: true,
    });
    const mesh = mergedParts(t, parts, m, false);
    mesh.castShadow = false;
    ballRig.add(mesh);
    facetMats.push(m);
  }
  tileGeo.dispose();
  const haloMat = additive(t, 0xf2f6ff, 0.4, 0.1);
  const halo = new t.Mesh(new t.SphereGeometry(BALL_R * 1.5, 14, 10), haloMat);
  halo.castShadow = false;
  halo.renderOrder = 2;
  ballRig.add(halo);

  // ---- the light shards: shafts down from the ball + floor patches -------
  const shardGrp = new t.Group();
  shardGrp.position.set(0, BALL_Y, 0);
  g.add(shardGrp);
  const FLOOR_Y = 0.115; // just over the pad lip
  const shaftParts: PartSpec[] = [];
  const patchParts: PartSpec[] = [];
  for (let j = 0; j < shards; j += 1) {
    const az = (j / shards) * Math.PI * 2 + hash01(seed * 7.3 + j) * 0.4;
    const el = 1.0 + hash01(seed * 11.7 + j * 5.1 + 2) * 0.35; // rad below horizontal
    const drop = BALL_Y - FLOOR_Y;
    const reach = drop / Math.tan(el); // 0.61…1.74 — a shard lands on the path, not the next park over
    const dir = new t.Vector3(Math.sin(az) * Math.cos(el), -Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    const near = BALL_R * 0.95;
    const len = drop / Math.sin(el) - near;
    shaftParts.push({
      geo: new t.CylinderGeometry(0.15, 0.03, len, 6, 1, true),
      matrix: new t.Matrix4()
        .makeRotationFromQuaternion(new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir))
        .setPosition(dir.clone().multiplyScalar(near + len / 2)),
    });
    const fm = new t.Matrix4().makeRotationY(az);
    fm.setPosition(Math.sin(az) * reach, -drop + 0.004, Math.cos(az) * reach);
    fm.multiply(new t.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new t.Matrix4().makeScale(0.24, 0.72, 1));
    patchParts.push({ geo: new t.CircleGeometry(0.5, 16), matrix: fm });
  }
  const shaftMat = additive(t, paletteAt(0), 0.6, 0.1);
  const patchMat = additive(t, paletteAt(0), 0.9, 0.3);
  ([
    [shaftParts, shaftMat, 3],
    [patchParts, patchMat, 4],
  ] as [PartSpec[], THREE.Material, number][]).forEach(([parts, material, order]) => {
    const mesh = mergedParts(t, parts, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = order;
    shardGrp.add(mesh);
  });

  // ---- ONE real light: the ball wash (night-gated) -----------------------
  const wash = new t.PointLight(paletteAt(0), 0, 5.5, 2);
  wash.position.set(0, BALL_Y - BALL_R - 0.2, 0);
  g.add(wash);

  const WHITE = new t.Color(0xffffff);
  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    const dom = paletteAt(step);
    // facet shells scintillate on hashed beat offsets, tint pulled to silver
    facetMats.forEach((m, i) => {
      const ph = hash01(i * 17 + 5 + seed);
      m.emissive.setHex(paletteAt(beatStep(time, ph) + i * 2)).lerp(WHITE, 0.55);
      m.emissiveIntensity = 0.1 + gain * 0.5 * beatPulse(time, ph) * (0.72 + 0.28 * Math.sin(time * 1.7 + i));
    });
    haloMat.emissive.setHex(dom).lerp(WHITE, 0.7);
    haloMat.emissiveIntensity = 0.3 + 1.1 * nk * beatPulse(time, 0);
    haloMat.opacity = 0.035 + 0.12 * nk;
    ballRig.rotation.y = time * 0.5;
    ballRig.rotation.x = 0.09 * Math.sin(time * 0.23);
    // the shard rig sweeps on the absolute clock and blooms on the beat
    shardGrp.rotation.y = time * 0.38 + seed * 0.7;
    // the shards BREATHE BY DAY TOO (the 0.3 / 0.12 day terms): with the bloom
    // gated purely on nightK the whole shard rig froze solid in daylight
    const bloom = beatPulse(time, 0.12) * (0.78 + 0.22 * beatKick(time, 0.06));
    shaftMat.emissive.setHex(dom);
    shaftMat.emissiveIntensity = 0.15 + (0.3 + 1.4 * nk) * bloom;
    shaftMat.opacity = 0.02 + (0.04 + 0.18 * nk) * bloom;
    patchMat.emissive.setHex(dom);
    patchMat.emissiveIntensity = 0.2 + (0.4 + 2.1 * nk) * bloom;
    patchMat.opacity = 0.05 + (0.12 + 0.44 * nk) * bloom;
    wash.color.setHex(dom);
    wash.intensity = nk * (0.75 + 0.55 * beatPulse(time, 0));
  };

  return {
    group: g,
    update,
    radius: Math.max(PAD, BASE_R) + 0.1,
    height: BALL_Y + BALL_R,
    ballY: BALL_Y,
    dispose() {
      wash.dispose();
    },
  };
}

// ===========================================================================
// 4. LASER TRUSS — a box-truss span with moving heads
// ===========================================================================
// Same family as Discotron's chorded truss RING and its four heads, straightened
// out into the touring rig a club hangs over a plaza: a four-chord box truss on
// two A-FRAME legs with concrete ballast at each foot, `count` moving-head
// fixtures clamped under the lower chord (they PAN and TILT on the absolute
// clock, each on its own hashed rate), a hair-thin additive beam per head that
// punches on the downbeat, LED nodes chasing along the chord, and a low HAZE
// vent so the beams have something to bite on.
//
// A beam that lands OUTSIDE the rig's own footprint smears additive glow across
// the surrounding park, so the tilt band is chosen so every beam terminates on
// the ground inside ~1.9 u of the truss centreline — Discotron's shard-rig rule.
// ===========================================================================

export interface LaserTrussOpts {
  /** moving-head fixtures under the span (default 4; clamped 1…8) */
  count?: number;
  /** deterministic variation seed (default 0) */
  seed?: number;
  /** half the span between leg centres (default 1.15) */
  halfWidth?: number;
  /** the low haze vent, so the beams read volumetrically (default true, 48
   *  particles — the pack's entire particle budget) */
  haze?: boolean;
}

export interface LaserTrussBuilt extends ComposableBuilt {
  update: (time: number) => void;
  /** half the span between leg centres, for the leg blockers */
  halfWidth: number;
  /** half-extents of ONE A-frame leg footprint (x, z) */
  legHalf: [number, number];
  /** overall height */
  height: number;
}

export function buildLaserTruss(t: typeof THREE, opts: LaserTrussOpts = {}): LaserTrussBuilt {
  const g = new t.Group();
  const seed = opts.seed ?? 0;
  const heads = clampCount(opts.count, 1, 8, 4);
  const halfW = opts.halfWidth ?? 1.15;
  const wantHaze = opts.haze ?? true;
  const TRUSS_LOW = 2.28;
  const TRUSS_TOP = 2.56;
  const SPLAY = 0.34; // A-frame foot spread in z

  // ---- A-frame legs + ballast -------------------------------------------
  const tubeParts: PartSpec[] = [];
  const ballast: MergedBoxSpec[] = [];
  const tieParts: MergedBoxSpec[] = [];
  const tubeGeo = new t.CylinderGeometry(0.045, 0.055, 1, 10);
  [-1, 1].forEach((sx) => {
    const lx = sx * halfW;
    [-1, 1].forEach((sz) => {
      const a = new t.Vector3(lx, 0.09, sz * SPLAY);
      const b = new t.Vector3(lx, TRUSS_LOW, 0);
      const d = new t.Vector3().subVectors(b, a);
      tubeParts.push({ geo: tubeGeo, matrix: alongDir(t, a, d, d.length()).scale(new t.Vector3(1, d.length(), 1)), uv: [1, 8] });
      ballast.push({ dims: [0.26, 0.09, 0.24], pos: [lx, 0.045, sz * SPLAY], repeat: [2, 1] });
    });
    // horizontal ties + one diagonal, so the A-frame reads as a frame
    [0.75, 1.5].forEach((ty) => {
      const spread = SPLAY * (1 - (ty - 0.09) / (TRUSS_LOW - 0.09));
      tieParts.push({ dims: [0.03, 0.03, spread * 2], pos: [lx, ty, 0] });
    });
    tieParts.push({ dims: [0.024, 0.024, 0.9], pos: [lx, 1.12, 0], rotX: 0.62 });
  });
  g.add(mergedParts(t, tubeParts, mat(t, STEEL, STEELY), false));
  tubeGeo.dispose();
  g.add(mergedBoxes(t, tieParts, STEEL, { ...STEELY, repeat: [1, 1] }));
  g.add(mergedBoxes(t, ballast, CONCRETE, { ...CRETE, repeat: [1, 1] }));

  // ---- the span: a real four-chord box truss ----------------------------
  const span = halfW * 2 + 0.3;
  const trussParts: MergedBoxSpec[] = [];
  ([
    [TRUSS_TOP, 0.11],
    [TRUSS_TOP, -0.11],
    [TRUSS_LOW, 0.11],
    [TRUSS_LOW, -0.11],
  ] as [number, number][]).forEach(([cy, cz]) => trussParts.push({ dims: [span, 0.055, 0.055], pos: [0, cy, cz], repeat: [10, 1] }));
  const BAYS = Math.max(5, Math.round(span / 0.24));
  for (let k = 0; k <= BAYS; k += 1) {
    const bx = -span / 2 + 0.05 + (k * (span - 0.1)) / BAYS;
    // vertical posts on both flanks + a zigzag diagonal, plus the top/bottom lacing
    [-0.11, 0.11].forEach((cz) => {
      trussParts.push({ dims: [0.032, TRUSS_TOP - TRUSS_LOW, 0.032], pos: [bx, (TRUSS_TOP + TRUSS_LOW) / 2, cz] });
      if (k < BAYS) {
        const dl = Math.hypot((span - 0.1) / BAYS, TRUSS_TOP - TRUSS_LOW);
        trussParts.push({
          dims: [dl, 0.024, 0.024],
          pos: [bx + (span - 0.1) / BAYS / 2, (TRUSS_TOP + TRUSS_LOW) / 2, cz],
          rotZ: (k % 2 ? 1 : -1) * Math.atan2(TRUSS_TOP - TRUSS_LOW, (span - 0.1) / BAYS),
        });
      }
    });
    trussParts.push({ dims: [0.028, 0.028, 0.22], pos: [bx, TRUSS_TOP, 0] });
    trussParts.push({ dims: [0.028, 0.028, 0.22], pos: [bx, TRUSS_LOW, 0] });
  }
  g.add(mergedBoxes(t, trussParts, STEEL, { ...STEELY, repeat: [1, 1], rough: 0.34 }));

  // ---- LED nodes along the lower chord, 2 chase groups ------------------
  const chordMats: THREE.MeshStandardMaterial[] = [];
  for (let grp = 0; grp < 2; grp += 1) {
    const parts: PartSpec[] = [];
    const NODES = 16;
    for (let k = grp; k < NODES; k += 2) {
      const bx = -span / 2 + 0.1 + (k * (span - 0.2)) / (NODES - 1);
      parts.push({ geo: new t.BoxGeometry(0.05, 0.04, 0.05), matrix: mtx(t, [bx, TRUSS_LOW - 0.045, 0]) });
    }
    const m = lamp(t, paletteAt(grp), 0.2);
    const mesh = mergedParts(t, parts, m);
    mesh.castShadow = false;
    mesh.userData.lodDetail = true;
    g.add(mesh);
    chordMats.push(m);
  }

  // ---- the moving heads: yoke + panning housing + tilting beam ----------
  interface Head {
    pan: THREE.Group;
    tilt: THREE.Group;
    beamMesh: THREE.Mesh;
    patch: THREE.Mesh;
    lens: THREE.MeshStandardMaterial;
    beam: THREE.MeshStandardMaterial;
    rate: number;
    phase: number;
    slot: number;
  }
  const headRigs: Head[] = [];
  /** the tilt pivot's height above grade — the beam length / ground-reach maths
   *  below is all measured from here (piece-local, so `scale` comes for free) */
  const PIVOT_Y = TRUSS_LOW - 0.32;
  // Every head's static furniture is BATCHED into one mesh per moving group
  // (pan, tilt) and the clamps/stubs into two shared top-level batches: hand-
  // placed, four heads cost 56 draw calls on their own, which is more than the
  // whole rest of the pack put together.
  const clampBoxes: MergedBoxSpec[] = [];
  const stubParts: PartSpec[] = [];
  for (let i = 0; i < heads; i += 1) {
    const hx = heads === 1 ? 0 : -halfW * 0.86 + (i * (halfW * 1.72)) / (heads - 1);
    clampBoxes.push({ dims: [0.09, 0.05, 0.14], pos: [hx, TRUSS_LOW - 0.05, 0] });
    stubParts.push({ geo: new t.CylinderGeometry(0.02, 0.02, 0.1, 8), matrix: mtx(t, [hx, TRUSS_LOW - 0.11, 0]) });
    const pan = new t.Group();
    pan.position.set(hx, TRUSS_LOW - 0.17, 0);
    g.add(pan);
    // the yoke: a base block and two arms straddling the housing. Everything
    // here is a size UP from the first pass, where a 0.11-wide housing read as
    // a dark lump with a coloured dot — a moving head has to be legible as a
    // FIXTURE at park zoom or the truss looks like bare scaffolding.
    const yoke: PartSpec[] = [
      { geo: new t.BoxGeometry(0.16, 0.07, 0.16), matrix: mtx(t, [0, 0.02, 0]), uv: [1, 1] },
      { geo: new t.BoxGeometry(0.032, 0.19, 0.085), matrix: mtx(t, [-0.09, -0.085, 0]), uv: [1, 1] },
      { geo: new t.BoxGeometry(0.032, 0.19, 0.085), matrix: mtx(t, [0.09, -0.085, 0]), uv: [1, 1] },
    ];
    pan.add(mergedParts(t, yoke, mat(t, GRAPHITE, METAL)));
    const yokeChrome: PartSpec[] = [
      { geo: new t.BoxGeometry(0.17, 0.02, 0.17), matrix: mtx(t, [0, 0.06, 0]) }, // pan-bearing cap
      { geo: new t.CylinderGeometry(0.024, 0.024, 0.026, 10), matrix: mtx(t, [-0.105, -0.15, 0], [0, 0, Math.PI / 2]) },
      { geo: new t.CylinderGeometry(0.024, 0.024, 0.026, 10), matrix: mtx(t, [0.105, -0.15, 0], [0, 0, Math.PI / 2]) },
    ];
    pan.add(mergedParts(t, yokeChrome, mat(t, CHROME, CHROMEY)));
    const tilt = new t.Group();
    tilt.position.set(0, -0.15, 0);
    pan.add(tilt);
    tilt.add(box(t, [0.145, 0.135, 0.2], GLOSS, [0, 0, 0.015], { ...GLOSSY, repeat: [1, 1] })); // housing
    const tiltChrome: PartSpec[] = [
      { geo: new t.BoxGeometry(0.155, 0.028, 0.09), matrix: mtx(t, [0, 0.07, -0.02]) }, // top heatsink rail
      { geo: new t.CylinderGeometry(0.06, 0.062, 0.035, 14), matrix: mtx(t, [0, 0, 0.105], [Math.PI / 2, 0, 0]) }, // bezel
    ];
    tilt.add(mergedParts(t, tiltChrome, mat(t, CHROME, CHROMEY)));
    const slot = i % PULSE_PALETTE.length;
    const lensMat = lamp(t, paletteAt(slot + 1), 0.22);
    const lens = new t.Mesh(new t.CylinderGeometry(0.045, 0.045, 0.02, 14), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.125);
    lens.castShadow = false;
    tilt.add(lens);
    // the BEAM: a tapered open cone out of the lens along the tilt group's +z,
    // built at UNIT length and stretched every frame so it always terminates
    // exactly on the ground. A fixed-length beam cannot: the tilt sweeps over a
    // band, so one length either stops in mid-air at the steep end or drives
    // through the turf at the shallow end.
    const beamMat = additive(t, paletteAt(slot + 1), 0.5, 0.16);
    // 0.055 → 0.016: the first pass at 0.085 read as a translucent PLANK. A
    // laser is a hair with a bloom, and the bloom is the additive material's
    // job, not the radius'.
    const beam = new t.Mesh(new t.CylinderGeometry(0.055, 0.016, 1, 6, 1, true), beamMat);
    beam.rotation.x = Math.PI / 2; // local +y → the tilt group's +z
    beam.castShadow = false;
    beam.receiveShadow = false;
    beam.renderOrder = 3;
    tilt.add(beam);
    // ...and the PATCH where it lands: an elongated additive ellipse on the
    // grass, parented to the PAN group so it swings round with the beam. A beam
    // with no terminus reads as a stick poking out of the truss.
    const patch = new t.Mesh(new t.CircleGeometry(0.5, 16), beamMat);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(0.24, 0.72, 1);
    patch.castShadow = false;
    patch.receiveShadow = false;
    patch.renderOrder = 4;
    pan.add(patch);
    headRigs.push({
      pan,
      tilt,
      beamMesh: beam,
      patch,
      lens: lensMat,
      beam: beamMat,
      rate: 0.28 + hash01(seed * 3.7 + i * 9.1) * 0.3,
      phase: hash01(seed * 5.9 + i * 4.3) * 6.28,
      slot,
    });
  }
  g.add(mergedBoxes(t, clampBoxes, CHROME, CHROMEY));
  g.add(mergedParts(t, stubParts, mat(t, GRAPHITE_D, METAL)));

  // ---- the haze vent (48 particles — the pack's whole particle budget) ---
  const haze = wantHaze
    ? buildEmitter(t, {
        max: 48,
        rate: 7,
        life: 3.4,
        lifeVar: 0.8,
        velocity: [0, 0.12, 0],
        spread: 0.15,
        gravity: -0.01,
        size: 0.12,
        sizeEnd: 0.52,
        color: 0xdcd2ff,
        colorEnd: 0x3a2b6a,
        opacity: 0.18,
        additive: true,
      })
    : null;
  if (haze) {
    // the HAZER is a real unit parked at the foot of the left leg, not a grille
    // dropped in the middle of the walk-through: a small road case with chrome
    // corner tabs, a chrome grille lid and a short nozzle. The first pass left a
    // bare black box sitting mid-span and it read as litter on the grass.
    const hz = new t.Group();
    hz.position.set(-halfW + 0.42, 0, SPLAY + 0.1);
    hz.rotation.y = -0.35;
    g.add(hz);
    hz.add(box(t, [0.3, 0.17, 0.22], CASE, [0, 0.085, 0], { tex: 'plastic', repeat: [2, 1], rough: 0.42 }));
    hz.add(box(t, [0.31, 0.02, 0.23], CHROME, [0, 0.18, 0], CHROMEY));
    const tabs: PartSpec[] = [];
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) => tabs.push({ geo: new t.BoxGeometry(0.04, 0.04, 0.04), matrix: mtx(t, [sx * 0.14, 0.17, sz * 0.1]) })),
    );
    const tabMesh = mergedParts(t, tabs, mat(t, CHROME, CHROMEY));
    tabMesh.userData.lodDetail = true;
    hz.add(tabMesh);
    hz.add(cyl(t, 0.03, 0.038, 0.1, GRAPHITE_D, [0.02, 0.23, 0.05], { ...METAL, seg: 10, rotX: 0.35 })); // nozzle
    hz.add(cyl(t, 0.014, 0.014, 0.22, RUBBER, [-0.1, 0.02, 0.16], { rough: 0.85, seg: 6, rotX: Math.PI / 2 })); // feed hose
    haze.setOrigin(-halfW + 0.44, 0.28, SPLAY + 0.16);
    g.add(haze.points);
  }

  // ---- ONE real light: a centre downlight under the span ----------------
  const down = new t.PointLight(paletteAt(1), 0, 4, 2);
  down.position.set(0, TRUSS_LOW - 0.5, 0);
  g.add(down);

  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.35 + 1.25 * nk;
    const step = beatStep(time);
    const kick = beatKick(time);
    headRigs.forEach((h, i) => {
      // PAN sweeps continuously; TILT breathes between 0.72 and 1.18 rad below
      // horizontal, which keeps every beam terminating on the ground inside
      // ~1.7 u of the head instead of raking the next ride over. The sign is
      // POSITIVE: a tilt group's local +z maps to (0, −sin a, cos a) under
      // rotation.x = a, so the first pass's −a fired every beam at the SKY.
      h.pan.rotation.y = Math.sin(time * h.rate + h.phase) * 1.05;
      const a = 0.95 + 0.23 * Math.sin(time * h.rate * 1.7 + h.phase * 1.3);
      h.tilt.rotation.x = a;
      // stretch the unit beam to reach the grass, and put its patch where it lands
      const drop = PIVOT_Y - 0.02;
      const L = drop / Math.sin(a);
      h.beamMesh.scale.y = L - 0.13;
      h.beamMesh.position.set(0, 0, 0.13 + (L - 0.13) / 2);
      h.patch.position.set(0, 0.014 - PIVOT_Y - 0.15, drop / Math.tan(a));
      const col = paletteAt(step + h.slot + 1);
      h.lens.color.setHex(col);
      h.lens.emissive.setHex(col);
      h.lens.emissiveIntensity = 0.2 + gain * (0.5 + 1.7 * beatKick(time, i * 0.25));
      // the beam BREATHES BY DAY TOO (a 0.25 day term): night-only additive
      // terms freeze the whole light show at nightK 0, and a daylight probe of
      // this pack has to be able to SEE the beat in the emissives
      const bk = 0.3 + 0.7 * beatKick(time, i * 0.12);
      h.beam.emissive.setHex(col);
      h.beam.emissiveIntensity = 0.2 + (0.35 + 1.75 * nk) * bk;
      h.beam.opacity = 0.02 + (0.04 + 0.22 * nk) * bk;
    });
    chordMats.forEach((m, i) => {
      const on = ((step % 2) + 2) % 2 === i;
      const col = paletteAt(step + i * 2);
      m.color.setHex(col);
      m.emissive.setHex(col);
      m.emissiveIntensity = (on ? 0.3 + 1.5 * gain : 0.12 + 0.2 * gain) * beatPulse(time, i * 0.1);
    });
    down.color.setHex(paletteAt(step + 1));
    down.intensity = nk * (0.35 + 0.5 * kick);
    haze?.update(time);
  };

  return {
    group: g,
    update,
    halfWidth: halfW,
    legHalf: [0.2, SPLAY + 0.14],
    height: TRUSS_TOP + 0.03,
    dispose() {
      down.dispose();
      haze?.dispose();
    },
  };
}

// ===========================================================================
// 5. LIGHT TILES — a beat-synced light-up floor patch
// ===========================================================================
// A patch of illuminated dance-floor tiles set in a graphite grout plate inside
// a chrome kerb, ankle-high so it can be scattered along a path or laid as an
// apron in front of the arch.
//
// IT IS THE SAME CLOCK AS <DanceFloor>, TILE FOR TILE. Each tile takes a hashed
// beat-phase offset `ph` and a hashed palette offset `off`, steps
// `PULSE_PALETTE[(beatStep(time, ph) + off) % 4]` once per beat and blooms on
// DanceFloor's own `0.55 + 0.45·|sin(π(t·BEAT_HZ + ph))|` curve at
// `gain = 0.4 + 1.1·nightK` — the floor's exact three lines, over the cool
// palette subset. ON TOP of that the patch runs a RADIAL RIPPLE: a `beatKick`
// spike delayed by the tile's ring index, so a bright wave visibly runs outward
// from the centre once per beat and the patch reads as a coordinated FLOOR
// rather than as N independent blinking squares.
//
// Flat and ankle-deep, so it registers NO blocker by default — the same call
// <TidePool> and <LavaFissure> make. A blocker here would carve holes in the
// walk network exactly where the piece is meant to be walked on.
// ===========================================================================

export interface LightTilesOpts {
  /** tiles per side (default 3; clamped 1…8) */
  count?: number;
  /** tile pitch in world units (default 0.55) */
  tile?: number;
  /** deterministic variation seed (default 0) */
  seed?: number;
}

export interface LightTilesBuilt extends ComposableBuilt {
  update: (time: number) => void;
  /** half-extent of the whole patch including the kerb */
  half: number;
  /** tiles per side as built */
  tiles: number;
  /** walking surface height (the tile tops) */
  topY: number;
}

export function buildLightTiles(t: typeof THREE, opts: LightTilesOpts = {}): LightTilesBuilt {
  const g = new t.Group();
  const seed = opts.seed ?? 0;
  const n = clampCount(opts.count, 1, 8, 3);
  const pitch = Math.max(0.2, opts.tile ?? 0.55);
  const field = n * pitch;
  const half = field / 2;
  const PLINTH_H = 0.05;
  const GROUT_H = 0.02;
  const TILE_H = 0.035;
  const topY = PLINTH_H + GROUT_H + TILE_H;

  // ---- slab + grout plate + chrome kerb ---------------------------------
  g.add(box(t, [field + 0.12, PLINTH_H, field + 0.12], CONCRETE, [0, PLINTH_H / 2, 0], { ...CRETE, repeat: [Math.max(2, n * 2), Math.max(2, n * 2)] }));
  g.add(box(t, [field + 0.03, GROUT_H, field + 0.03], DECK, [0, PLINTH_H + GROUT_H / 2, 0], { rough: 0.28 }));
  const kerb: MergedBoxSpec[] = [];
  const kerbHalf = half + 0.06;
  ([
    [0, kerbHalf, field + 0.14, 0.03],
    [0, -kerbHalf, field + 0.14, 0.03],
  ] as [number, number, number, number][]).forEach(([kx, kz, len, thk]) =>
    kerb.push({ dims: [len, 0.03, thk], pos: [kx, PLINTH_H + 0.015, kz] }),
  );
  [-kerbHalf, kerbHalf].forEach((kx) => kerb.push({ dims: [0.03, 0.03, field + 0.14], pos: [kx, PLINTH_H + 0.015, 0] }));
  g.add(mergedBoxes(t, kerb, CHROME, CHROMEY));

  // ---- the tiles: one material each ------------------------------------
  interface Tile {
    m: THREE.MeshStandardMaterial;
    ph: number;
    off: number;
    ring: number;
  }
  const tiles: Tile[] = [];
  const tileGeo = new t.BoxGeometry(pitch - 0.055, TILE_H, pitch - 0.055);
  const c = (n - 1) / 2;
  for (let ix = 0; ix < n; ix += 1) {
    for (let iz = 0; iz < n; iz += 1) {
      const m = lamp(t, paletteAt(0), 0.4);
      const mesh = new t.Mesh(tileGeo, m);
      mesh.position.set(-half + pitch * (ix + 0.5), PLINTH_H + GROUT_H + TILE_H / 2, -half + pitch * (iz + 0.5));
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      g.add(mesh);
      tiles.push({
        m,
        ph: hash01(ix * 53 + iz * 97 + 5 + seed * 13),
        off: Math.floor(hash01(ix * 29 + iz * 71 + 9 + seed * 17) * PULSE_PALETTE.length),
        ring: Math.max(Math.abs(ix - c), Math.abs(iz - c)),
      });
    }
  }

  // ---- corner LED studs (fine detail) + an additive bloom plate ---------
  const studs: PartSpec[] = [];
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) =>
      studs.push({ geo: new t.CylinderGeometry(0.022, 0.026, 0.03, 10), matrix: mtx(t, [sx * kerbHalf, PLINTH_H + 0.03, sz * kerbHalf]) }),
    ),
  );
  const studMat = lamp(t, paletteAt(1), 0.2);
  const studMesh = mergedParts(t, studs, studMat);
  studMesh.castShadow = false;
  studMesh.userData.lodDetail = true;
  g.add(studMesh);
  // ONE additive quad a hair over the tiles: at night a lit floor washes the
  // air just above it, and it stops the patch reading as flat coloured paint
  const bloomMat = additive(t, paletteAt(0), 0.6, 0.1);
  const bloom = new t.Mesh(new t.PlaneGeometry(field + 0.06, field + 0.06), bloomMat);
  bloom.rotation.x = -Math.PI / 2;
  bloom.position.y = topY + 0.012;
  bloom.castShadow = false;
  bloom.receiveShadow = false;
  bloom.renderOrder = 4;
  g.add(bloom);

  const update = (time: number) => {
    const nk = smooth(nightKOf(g));
    const gain = 0.4 + 1.1 * nk; // DanceFloor's own gain: ~40 % glow by day
    const step = beatStep(time);
    tiles.forEach((tl) => {
      // ---- DanceFloor's exact three lines, over PULSE_PALETTE ----
      const col = paletteAt(beatStep(time, tl.ph) + tl.off);
      tl.m.color.setHex(col);
      tl.m.emissive.setHex(col);
      const pulse = beatPulse(time, tl.ph);
      // ---- plus the radial ripple: a kick delayed by the ring index ----
      const ripple = beatKick(time, -tl.ring * 0.22);
      tl.m.emissiveIntensity = gain * pulse * (0.78 + 0.55 * ripple);
    });
    const dom = paletteAt(step);
    studMat.color.setHex(dom);
    studMat.emissive.setHex(dom);
    studMat.emissiveIntensity = 0.18 + gain * 0.9 * beatKick(time, 0.5);
    bloomMat.emissive.setHex(dom);
    bloomMat.emissiveIntensity = 0.3 + 1.6 * nk * beatPulse(time, 0.1);
    bloomMat.opacity = 0.02 + 0.13 * nk * beatPulse(time, 0.1);
  };

  return { group: g, update, half: kerbHalf, tiles: n, topY };
}

// ===========================================================================
// THE COMPOSABLE COMPONENTS
// ===========================================================================
// Each mounts into the surrounding <Park> / <ScenePreview> at
// `position` / `rotation` / `scale` (y settles onto the plaza/terrain) and
// renders null — components never render a <Stage> themselves; the preview
// staging lives in PulseScenery.previews.tsx.
//
// BLOCKERS (GameManager/Context.md "Blockers") — opt-in for the flat pieces,
// on by default for the solid ones, and NEVER over a span a guest is meant to
// walk under:
//   * <SpeakerStack>    circle over the dolly — ON by default (half a tonne of
//                       flight cases on castors)
//   * <MirrorBallPylon> circle over the pad — ON by default
//   * <LaserTruss>      TWO rects, one per A-frame LEG — ON by default. A rect
//                       over the whole span would fence off the walk-through
//                       that is the entire point of hanging a truss overhead.
//   * <NeonArch>        TWO rects, one per POST — OFF by default: an arch is a
//                       GATEWAY, and the round-6 `scenery` gate plus the street
//                       lattice both want guests walking through it. Turn it on
//                       for an arch used as a backdrop rather than a doorway.
//   * <LightTiles>      nothing. Flat, ankle-high and meant to be walked ON
//                       (the same call <TidePool> and <LavaFissure> make).
// ===========================================================================

export interface NeonArchProps extends NeonArchOpts {
  /** keep guests out of the two POSTS (default FALSE — an arch is a gateway;
   *  set true for an arch used as a backdrop rather than a doorway) */
  blocking?: boolean;
}

/** `<NeonArch>` — the district's gateway arch: graphite posts, a chorded header
 *  truss, a real `buildNeonSign` marquee and a crown of neon tube arches that
 *  chase outward on the shared 2.2 Hz beat. The face carrying the marquee is
 *  local +z, so `rotation` aims it at the approach. */
export const NeonArch = composable<NeonArchProps, NeonArchBuilt>(
  'NeonArch',
  (t, props) => buildNeonArch(t, { text: props.text, count: props.count, seed: props.seed, halfWidth: props.halfWidth }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (!props.blocking) return; // a gateway, unless the author says otherwise
      const [wx, , wz] = position;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const offs = built.postHalf;
      const cleanups = [-1, 1].map((s) => {
        const lx = s * built.halfWidth * scale;
        return park.registerBlocker({
          rect: { cx: wx + lx * cos, cz: wz - lx * sin, hx: offs * scale, hz: offs * scale, yaw: rotation },
          label: `<NeonArch> post ${s < 0 ? 'L' : 'R'}`,
          height: built.height * scale,
          kind: 'scenery',
        });
      });
      return () => cleanups.forEach((c) => c());
    },
  },
);

export interface SpeakerStackProps extends SpeakerStackOpts {
  /** keep guests out of the stack (default true — it is a wall of flight cases) */
  blocking?: boolean;
}

/** `<SpeakerStack>` — a touring PA stack on a castored dolly (1-4 cabinets via
 *  `count`). The cones and the VU ladder face local +z, so `rotation` aims the
 *  stack at the crowd. */
export const SpeakerStack = composable<SpeakerStackProps, SpeakerStackBuilt>(
  'SpeakerStack',
  (t, props) => buildSpeakerStack(t, { count: props.count, seed: props.seed }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<SpeakerStack> PA stack',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface MirrorBallPylonProps extends MirrorBallPylonOpts {
  /** keep guests off the mast base (default true) */
  blocking?: boolean;
}

/** `<MirrorBallPylon>` — a faceted mirror ball up a tapering steel lattice mast,
 *  throwing rotating light shards onto the ground around it. Rotationally
 *  symmetric, so `rotation` only turns where the junction box sits. */
export const MirrorBallPylon = composable<MirrorBallPylonProps, MirrorBallPylonBuilt>(
  'MirrorBallPylon',
  (t, props) => buildMirrorBallPylon(t, { count: props.count, seed: props.seed, height: props.height }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<MirrorBallPylon> mast base',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface LaserTrussProps extends LaserTrussOpts {
  /** keep guests out of the two A-FRAME LEGS (default true). The SPAN is never
   *  blocked — walking under it is the point. */
  blocking?: boolean;
}

/** `<LaserTruss>` — a box-truss span on two A-frame legs with panning
 *  moving-head lasers under it. The span runs along local X, so `rotation`
 *  turns the gantry across a path. */
export const LaserTruss = composable<LaserTrussProps, LaserTrussBuilt>(
  'LaserTruss',
  (t, props) => buildLaserTruss(t, { count: props.count, seed: props.seed, halfWidth: props.halfWidth, haze: props.haze }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const [hx, hz] = built.legHalf;
      const cleanups = [-1, 1].map((s) => {
        const lx = s * built.halfWidth * scale;
        return park.registerBlocker({
          rect: { cx: wx + lx * cos, cz: wz - lx * sin, hx: hx * scale, hz: hz * scale, yaw: rotation },
          label: `<LaserTruss> A-frame leg ${s < 0 ? 'L' : 'R'}`,
          height: built.height * scale,
          kind: 'scenery',
        });
      });
      return () => cleanups.forEach((c) => c());
    },
  },
);

export interface LightTilesProps extends LightTilesOpts {
  /** register a blocker over the patch (default FALSE — the piece is ankle-high
   *  and meant to be walked ON; set true only for a decorative patch fenced off
   *  inside a plaza) */
  blocking?: boolean;
}

/** `<LightTiles>` — a beat-synced light-up floor patch, tile-for-tile on
 *  <DanceFloor>'s clock plus a radial ripple. Flat by design: no blocker
 *  unless asked. */
export const LightTiles = composable<LightTilesProps, LightTilesBuilt>(
  'LightTiles',
  (t, props) => buildLightTiles(t, { count: props.count, tile: props.tile, seed: props.seed }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (!props.blocking) return; // ankle-high by design
      const [wx, , wz] = position;
      return park.registerBlocker({
        rect: { cx: wx, cz: wz, hx: built.half * scale, hz: built.half * scale, yaw: rotation },
        label: '<LightTiles> floor patch',
        height: 0.12 * scale,
        kind: 'scenery',
      });
    },
  },
);

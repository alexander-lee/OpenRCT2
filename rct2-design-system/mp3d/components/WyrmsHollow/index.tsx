import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mergedBoxes, nightKOf } from '../Stage';
import type { MergedBoxSpec } from '../Stage';
import { buildRideSpline, compileTrackPieces, rateCoaster } from '../SplineRideKit';
import type { TrackPiece } from '../SplineRideKit';
import { buildRock } from '../Rock';
import { buildScenery } from '../SceneryPack';
import { buildPeep, SHIRTS, SKIN_TONES } from '../Guest';
import { hash01 } from '../ColorKit';
import type { TrackScheme } from '../ColorKit';
import { buildEmitter } from '../ParticleKit';
import type { Emitter } from '../ParticleKit';
import { createMotionGate, makeSeatWorld } from '../GameManager';
import { composableRide, collectTrackPieces } from '../Park';
import type { ComposableRideProps } from '../Park';

// ---------------------------------------------------------------------------
// WyrmsHollow — the DRAGON FAMILY COASTER of the THORNWICK GLADE, and the
// world's first component, so the enchanted-forest palette + the moss/ivy/root
// masonry helpers are exported from here for the rest of the world to share
// (the same way EmberWings owns the Emberfall lava language).
//
// THE DELIVERABLE IS THE BEAST. The train is not a train: it is a full
// articulated wyrm whose BODY IS THE VEHICLE. Eleven independent segments are
// handed straight to `buildRideSpline(...).run()`, which places segment i at
// `uHead − i·spacing/total` — so the creature is posed by the SPLINE FRAMES
// themselves and genuinely bends through every corner: the tail is still
// coming out of the last bend as the head enters the next one. On top of that
// the updater lays a travelling serpentine wave (phase-lagged per segment,
// amplitude weighted DOWN across the four ridden segments and UP through the
// neck and the tail) so it undulates as it runs instead of reading as a rigid
// sausage. Riders sit in saddles along its back behind the shoulders — which
// is WHY the body is the train: the flex is the ride.
//
//   * HEAD: cranium + tapering snout, brow ridges, a bony crest, two swept
//     back horns built from five tapering segments each, cheek and jaw spikes,
//     a HINGED LOWER JAW with two opposed rows of teeth, and glowing amber
//     eyes (day-and-night lerped, never gated to zero).
//   * WINGS: a real bone chain — humerus → forearm → wrist → four fingers of
//     two phalanges each — with the MEMBRANE rebuilt every frame as a
//     BufferGeometry from the live bone tips, so it stretches, creases and
//     BILLOWS with the beat. The beat is phase-lagged down the chain (shoulder
//     leads, elbow +0.9 rad behind, wrist +1.4, fingers +1.8) which is what
//     makes it read as a wing and not a rigid flap, and it FURLS when the ride
//     is parked (the motion gate's `speed` drives the fold).
//   * SCALED HIDE: every segment carries merged dorsal spine plates, a merged
//     row of overlapping flank shingles (`lodDetail`) and oxblood belly scutes.
//   * CLAWED LIMBS on the shoulder and haunch segments, a TAIL SPADE, and
//     SMOKE + EMBER BREATH from the nostrils (ParticleKit, 180 particles).
//
// THE RIDE is the shared spline machinery — `compileTrackPieces` +
// `buildRideSpline({ profile: 'coaster', type: 'steel' })` — threading a
// MOSSY RUIN: a broken tower the track runs clean through a collapsed breach
// in, crumbling arches over the rails, moss-furred masonry, ivy, and roots
// splitting the stone.
//
// Budget: 2 emitters (180 particles), 4 PointLights (three night-gated
// lanterns + the beast's own day-and-night amber head glow), `mergedBoxes` for
// every static repeat, `userData.lodDetail` on close-up-only detail.
// Deterministic throughout — hashed sines only, no Math.random / Date.now.
// ---------------------------------------------------------------------------

// ---- THE THORNWICK GLADE PALETTE (shared: import from here) ---------------
export const THORNWICK = {
  /** weathered ruin masonry, lichen-grey with a green cast */
  stone: 0x7c7f72,
  stoneDark: 0x5f6257,
  stoneShade: 0x4b4e45,
  /** the moss that furs every horizontal surface in the glade */
  moss: 0x4e6b3a,
  mossDeep: 0x3a5230,
  /** ivy: two leaf greens + a woody stem */
  ivy: 0x3f5c33,
  ivyLight: 0x577a3f,
  vine: 0x4a4032,
  /** roots breaking through the stone */
  root: 0x53442f,
  /** the enchanted deep green/violet the world is lit in */
  gloom: 0x2b2440,
  lantern: 0xffd28a,
} as const;

/** the glade's pod/flower stalk green. Lives here rather than in
 *  `ThornwickScenery`'s `GLADE` because this file is the world's FIRST component
 *  and the scenery pack imports FROM it — the same reason `glowGrains` is local. */
const GLADE_STALK = 0x4a6234;

/** the wyrm's own hide — muted creature colours; the GLOW is the eyes and the
 *  breath, never the body */
export const WYRM = {
  back: 0x4e5f39, // deep mossy green, dorsal
  flank: 0x404d33, // shaded flank
  shingle: 0x6b7a48, // the overlapping scale plates catching light
  belly: 0x6b392c, // oxblood underbelly
  horn: 0x7c7e73, // slate horn / claw / dorsal spike
  hornDark: 0x5c5e57,
  /** PALE BONE — brow, crown crest, dorsal spikes, eye sockets. The park's
   *  default camera is a ~50° three-quarter looking DOWN at mossy ground, and
   *  slate-grey keratin at that angle is the same value as the grass: the ridge
   *  and the horns simply vanish. This is the tone that reads against it. */
  bone: 0x9a9a88,
  /** the muzzle / cheek / maxilla plating. Round 8 built these out of `flank`
   *  (0x36432f) and the whole front of the skull — the most characterful part
   *  of the beast — fell into shadow whenever the sun was off to the side. A
   *  LIGHTER, warmer olive keeps the snout legible at park distance. */
  muzzle: 0x6f7a4a,
  /** the skull is a shade lighter than the body it rides on, so the head reads
   *  as a separate mass and not as the end of a pipe */
  skull: 0x5c6c3f,
  tooth: 0xd7cdb4, // bone
  membrane: 0x9c6a4e, // wing leather — WARM, and lighter than the bones on purpose
  /** the warm light that comes THROUGH a thin membrane (the emissive tint the
   *  vein texture masks — see `membraneCanvases`) */
  membraneLit: 0xd08a4e,
  eye: 0xffcf62, // amber
  saddle: 0x5b4430, // rider leather
} as const;

/** steel banking cap for a FAMILY layout: `coasterBankCap('steel', 0.70)` —
 *  the fast low corners only reach 0.96 g of effective lateral WITH it (1.09 g
 *  without), well inside validatePark's 1.27 g margin. */
const BANK = 0.7;
/** the station straight runs along local −x, so every compiled point has
 *  z ≤ 0 and the whole local +z face stays clear for the queue + huts */
const HEADING = -Math.PI / 2;
const START: [number, number, number] = [0, 0.55, 0];

/** RCT2 TrackColour: mossy-green rail over lichen-grey stonework supports */
const TRACK_COLOURS: TrackScheme = { main: 0x6e7c68, additional: 0x5d5142, supports: 0x74776c };

// ---------------------------------------------------------------------------
// THE CIRCUIT — "Wyrm's Coil"
//
// A family layout: a 2.8-unit chain lift out of the ruined station, a
// curvature-ramped corner at the 3.35 summit, the whole 2.8 back in one gentle
// 21° descent, then the long low run that threads the BROKEN TOWER, a shallow
// camelback for the airtime, and two more easy corners home.
//
// Every corner is CURVATURE-RAMPED (5 fragments, 6/12/54/12/6 = 90°) rather
// than a bare arc: a chorded arc welded onto a fast straight leaves a kink
// where the auto-bank has not developed yet, and that junction is the whole
// lateral-G budget (the MineTrainCoaster lesson). Four corners × 90° = 360°,
// so the layout comes home on the station heading with NOTHING synthesized.
//
// The two straight lengths are SOLVED (13.330 / 2.030): a four-corner circuit
// has exactly two degrees of freedom and the last authored piece has to land
// 0.30 u short of the station ON its axis, or `compileTrackPieces` closes the
// loop with a Dubins return leg straight through the track.
// ---------------------------------------------------------------------------
const crestCorner = (radius: number): TrackPiece[] => [
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
  { type: 'turnR', angle: 66, radius },
  { type: 'turnR', angle: 12, radius: radius * 2.6 },
];
const easyCorner = (radius: number): TrackPiece[] => [
  { type: 'turnR', angle: 6, radius: 12 },
  { type: 'turnR', angle: 12, radius: 7 },
  { type: 'turnR', angle: 54, radius },
  { type: 'turnR', angle: 12, radius: 7 },
  { type: 'turnR', angle: 6, radius: 12 },
];

/** the BOARDING PAD, ride-local — where <ConfigurableRide> delivers a guest.
 *  A module constant because §8b's STATION LOCK has to park the saddle band on
 *  the same point the composable hands the GameManager, and two copies of it
 *  would drift apart. */
const BOARD: [number, number, number] = [-1.3, 0.75, 0];

const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 2.8, length: 7.4 }, // 21° chain lift to a 3.35 summit
  { type: 'straight', length: 0.8 }, // level crest
  ...crestCorner(3.0),
  { type: 'straight', length: 0.8 },
  { type: 'drop', height: 2.8, length: 7.4 }, // the family descent — no plunge
  { type: 'straight', length: 1.6 },
  ...easyCorner(3.0),
  { type: 'straight', length: 13.33 }, // ← THE TOWER RUN (solved)
  ...easyCorner(3.0),
  { type: 'hill', height: 0.8, length: 8 }, // long shallow camelback: the airtime
  { type: 'straight', length: 2.03 }, // solved
  ...easyCorner(3.0),
  { type: 'straight', length: 1.4 }, // brake tail, landing 0.30 u short
];

// ===========================================================================
// THE WYRM
// ===========================================================================

/** segment radii, nose → tail spade: slim neck, deep shoulders and barrel,
 *  tapering tail. The SPINE stays at one height and the radii vary, exactly
 *  like a real serpent's silhouette. */
const SEG_R = [0.14, 0.15, 0.185, 0.28, 0.295, 0.28, 0.25, 0.195, 0.15, 0.1, 0.058];
const N_SEG = SEG_R.length; // 11
/** world units between segment centres — also the `run()` spacing */
const SEG_SPACING = 0.56;
/** the spine line, above the segment origin (which run() puts at rail top) */
const SPINE_Y = 0.34;
/** the spine ARCS: the neck rises to carry the head and the tail lifts off the
 *  track behind (a level spine reads as a pipe). Kept small — the step between
 *  neighbouring segments hides under the joint ball. */
const SEG_LIFT = [0.16, 0.1, 0.04, 0, 0, 0, 0, 0.01, 0.045, 0.09, 0.14];
/** the ridden segments — shoulders, barrel, loins, haunch: 4 × 2 = 8 seats */
const SADDLE_SEGS = [3, 4, 5, 6];
/** mean arc offset of the saddle band BEHIND the head, in world units — the
 *  STATION LOCK centres this band on the boarding pad (§8b) */
const SADDLE_MID_OFFSET = (SADDLE_SEGS.reduce((a, i) => a + i, 0) / SADDLE_SEGS.length) * SEG_SPACING;
/** saddle pads sit either side of the dorsal ridge; a seated peep's group
 *  origin rides 0.2225 under its hip (CoasterCar's number) */
const SADDLE_X = 0.185;
const SADDLE_TOP = 0.565;
const SEAT_ANCHOR_Y = SADDLE_TOP - 0.2225;
/** per-segment flex weighting: the neck weaves and the tail whips, the four
 *  RIDDEN segments stay composed (nobody wants to be thrashed) */
const FLEX_W = [1.15, 1.0, 0.8, 0.3, 0.22, 0.22, 0.3, 0.75, 1.1, 1.4, 1.7];

export interface WyrmDragonOpts {
  /** decorative riders in the saddles (default true; the registered ride turns
   *  them OFF so the GameManager's real guests fill the saddles) */
  riders?: boolean;
  /** nostril smoke + ember breath (default true) */
  breath?: boolean;
}

export interface WyrmDragonBuilt {
  /** the beast in ONE group, posed nose-to-tail (standalone / close-up use).
   *  `run()` re-parents the segments onto the ride, which is fine — three
   *  removes them from here automatically. */
  group: THREE.Group;
  /** 0 = head … 10 = tail spade. Hand this straight to `ride.run()`. */
  segments: THREE.Group[];
  /** 8 saddle anchors (GameManager seatWorld) */
  seatAnchors: THREE.Object3D[];
  /** the two nostril objects — breath emitter origins */
  nostrils: THREE.Object3D[];
  /** the amber head light (day-AND-night lerped: eyes and breath glow) */
  headLight: THREE.PointLight;
  /** the breath emitters' Points — PARENT THESE TO A STATIC GROUP (the ride
   *  group / the preview root), never to the head: particles have to be left
   *  behind in the world, and `update` converts the nostril pose into whatever
   *  space you parented them into. */
  breathPoints: THREE.Points[];
  /** free the breath emitters */
  dispose(): void;
  /**
   * `clock` absolute seconds, `speed` the motion gate's 0..1 (0 = parked: the
   * wings furl, the jaw closes, the breath dies back), `nightK` from nightKOf.
   * `chained` re-poses the segments as a free-standing serpentine chain — for
   * the close-up preview, where no `run()` is placing them.
   *
   * `tuck` (0..1) folds the wings on demand, independently of speed: the ride
   * ramps it up as the beast reaches the ruin so the wings pull in through the
   * breach instead of sweeping through the masonry, then lets them snap back
   * open on the far side. It is a MAX against the parked furl, never a sum, so
   * a parked beast in the tower stays folded rather than double-folding.
   */
  update(clock: number, speed: number, nightK: number, chained?: boolean, tuck?: number): void;
}

// ---------------------------------------------------------------------------
// THE WING MEMBRANE TEXTURE — the fix for "the wings read as flat cardboard".
//
// Round 8 hung a single flat leather tone on the membrane AND gave it degenerate
// UVs (every triangle got u ∈ {0, 0.5, 0}, so two of its three corners sampled
// the SAME texel column — the map could not have shown anything even if there
// had been something on it). Real membrane is thin skin over a vein network:
//
//   * DARK where it is thick — the root, the leading bones, and the free
//     trailing edge, which is a rolled hem;
//   * LIGHT and WARM in the panel middles, where the sun comes THROUGH it;
//   * veined, with primaries fanning out from the shoulder and secondaries
//     branching off them, plus hide mottling so it is not a clean sheet.
//
// Three canvases off one drawing pass, cached module-level (built once per
// page, shared by both wings):
//   albedo   — the leather tone: mottled, edge-darkened, veined dark
//   glow     — a contrast-stretched luminance of the albedo, used as the
//              EMISSIVE MAP: the thin panels light up warm, the veins and the
//              thick edges stay dark. That is the whole thin-skin read, and it
//              costs no transparency and no env map (this Stage has none, so
//              gloss is not available — `metalness ≥ 0.6` renders near-black).
//   bump     — the veins as RAISED ridges
//
// Deterministic: `hash01` only, no Math.random. The wing UVs are a real
// anatomical CHART — u runs out the span (0 = shoulder, 1 = wingtip), v runs
// across the chord (0 = leading edge, 1 = trailing edge) — so the gradients and
// the vein fan below are drawn in a space that means something on the beast.
// ---------------------------------------------------------------------------
interface MembraneCanvases {
  albedo: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  bump: HTMLCanvasElement;
}
let _membraneCanvases: MembraneCanvases | null = null;

function membraneCanvases(): MembraneCanvases {
  if (_membraneCanvases) return _membraneCanvases;
  const S = 256;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const albedo = mk();
  const glow = mk();
  const bump = mk();
  const ca = albedo.getContext('2d')!;
  const cg = glow.getContext('2d')!;
  const cb = bump.getContext('2d')!;

  ca.fillStyle = 'rgb(156,106,78)'; // WYRM.membrane
  ca.fillRect(0, 0, S, S);
  cb.fillStyle = 'rgb(120,120,120)';
  cb.fillRect(0, 0, S, S);

  // ---- HIDE MOTTLE: soft blotches, warm and cool, so the panel is skin.
  // SMALL and LOW-CONTRAST on purpose: the first draft used big high-alpha
  // blobs and, combined with the vein fan, the whole membrane read as PLYWOOD.
  for (let i = 0; i < 260; i += 1) {
    const x = hash01(i * 1.7 + 0.4) * S;
    const y = hash01(i * 2.3 + 1.9) * S;
    const r = 3 + hash01(i * 3.1 + 0.8) * 13;
    ca.globalAlpha = 0.06 + hash01(i * 5.3 + 3.7) * 0.07;
    ca.fillStyle = hash01(i * 4.7 + 2.2) > 0.5 ? 'rgb(206,150,110)' : 'rgb(96,58,42)';
    ca.beginPath();
    ca.arc(x, y, r, 0, Math.PI * 2);
    ca.fill();
  }
  ca.globalAlpha = 1;

  // ---- EDGE DARKENING: the membrane is THICK at the root and along the
  // leading bones, and the free trailing edge is a rolled hem
  const vg = ca.createLinearGradient(0, 0, 0, S);
  vg.addColorStop(0, 'rgba(58,32,23,0.78)'); // v=0: the leading bones
  vg.addColorStop(0.16, 'rgba(58,32,23,0)');
  vg.addColorStop(0.7, 'rgba(48,26,19,0)');
  vg.addColorStop(0.93, 'rgba(48,26,19,0.5)');
  vg.addColorStop(1, 'rgba(40,21,16,0.88)'); // v=1: the trailing hem
  ca.fillStyle = vg;
  ca.fillRect(0, 0, S, S);
  const hg = ca.createLinearGradient(0, 0, S, 0);
  hg.addColorStop(0, 'rgba(62,34,25,0.62)'); // u=0: the thick root
  hg.addColorStop(0.22, 'rgba(62,34,25,0)');
  hg.addColorStop(0.9, 'rgba(214,166,124,0)');
  hg.addColorStop(1, 'rgba(214,166,124,0.22)'); // the wingtip thins out
  ca.fillStyle = hg;
  ca.fillRect(0, 0, S, S);

  // ---- THE VEINS: seven primaries fanning out of the shoulder, each with six
  // secondaries, plus the CHORD-WISE WRINKLE lines that are the real membrane
  // tell — skin that has been folded a million times creases ACROSS the veins,
  // and without them a radial fan on its own just reads as wood grain. Drawn
  // TWICE — dark on the albedo, bright on the bump (`w < 1` marks the bump pass).
  const veins = (cx: CanvasRenderingContext2D, style: string, w: number) => {
    cx.lineCap = 'round';
    cx.strokeStyle = style;
    for (let i = 0; i < 7; i += 1) {
      // the fan DIVERGES hard: the primaries all leave a tight root patch and
      // spread across the whole chord, so it can never look like parallel planks
      const y0 = S * (0.2 + (hash01(i * 2.9 + 0.7) - 0.5) * 0.1);
      const y1 = S * (0.04 + (i / 6) * 0.96);
      cx.lineWidth = (2.3 - i * 0.14) * w;
      cx.beginPath();
      cx.moveTo(-6, y0);
      for (let k = 1; k <= 14; k += 1) {
        const f = k / 14;
        cx.lineTo(f * S * 1.06, y0 + (y1 - y0) * f ** 0.62 + Math.sin(f * 5.5 + i * 1.3) * S * 0.016);
      }
      cx.stroke();
      for (let b = 0; b < 6; b += 1) {
        const f0 = 0.16 + b * 0.135 + hash01(i * 3.3 + b * 1.9) * 0.06;
        const x0 = f0 * S * 1.06;
        const yb = y0 + (y1 - y0) * f0 ** 0.62;
        const dir = hash01(i * 5.1 + b * 1.3) > 0.5 ? 1 : -1;
        cx.lineWidth = (1.25 - b * 0.1) * w;
        cx.beginPath();
        cx.moveTo(x0, yb);
        for (let k = 1; k <= 6; k += 1) {
          const f = k / 6;
          cx.lineTo(x0 + f * S * 0.16, yb + dir * f * S * (0.05 + 0.04 * hash01(i * 1.1 + b)) + Math.sin(f * 4 + b) * 1.3);
        }
        cx.stroke();
      }
    }
    // CHORD-WISE WRINKLES: faint arcs running across the fan
    cx.globalAlpha = w >= 1 ? 0.34 : 0.5;
    for (let i = 0; i < 30; i += 1) {
      const u = 0.1 + hash01(i * 1.9 + 2.4) * 0.94;
      const v0 = hash01(i * 3.7 + 0.9) * 0.8;
      cx.lineWidth = (0.9 + hash01(i * 2.3) * 0.7) * w;
      cx.beginPath();
      for (let k = 0; k <= 7; k += 1) {
        const f = k / 7;
        const v = v0 + f * (0.16 + hash01(i * 4.1) * 0.2);
        const x = (u + Math.sin(f * 2.6 + i) * 0.022) * S;
        if (k === 0) cx.moveTo(x, v * S);
        else cx.lineTo(x, v * S);
      }
      cx.stroke();
    }
    cx.globalAlpha = 1;
    // capillaries: short hashed hairs, albedo only
    if (w >= 1) {
      cx.lineWidth = 0.7;
      cx.globalAlpha = 0.55;
      for (let i = 0; i < 170; i += 1) {
        const x = hash01(i * 7.3 + 1.1) * S;
        const y = hash01(i * 4.9 + 6.2) * S;
        const a = hash01(i * 2.1 + 0.5) * Math.PI * 2;
        cx.beginPath();
        cx.moveTo(x, y);
        cx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
        cx.stroke();
      }
      cx.globalAlpha = 1;
    }
  };
  veins(ca, 'rgba(84,44,33,0.8)', 1);
  veins(cb, 'rgba(238,238,238,0.9)', 0.9);

  // ---- THE GLOW MAP: contrast-stretched luminance of the albedo, so the
  // emissive lands exactly where the skin is THIN (bright panel middles) and
  // dies on the veins, the root and the trailing hem.
  const src = ca.getImageData(0, 0, S, S).data;
  const im = cg.createImageData(S, S);
  const G = im.data;
  for (let p = 0; p < S * S; p += 1) {
    const o = p * 4;
    const lum = (src[o] * 0.42 + src[o + 1] * 0.42 + src[o + 2] * 0.16) / 255;
    const v = Math.max(0, Math.min(1, (lum - 0.3) / 0.32));
    G[o] = G[o + 1] = G[o + 2] = Math.round(255 * v ** 1.5);
    G[o + 3] = 255;
  }
  cg.putImageData(im, 0, 0);

  _membraneCanvases = { albedo, glow, bump };
  return _membraneCanvases;
}

/** the wing UV CHART: u = out the span (0 shoulder → 1 wingtip), v = across the
 *  chord (0 leading edge → 1 trailing edge). `membraneCanvases` paints in this
 *  space, so the gradients land on the right anatomy. Keyed by slot name; the
 *  triangle list below looks each corner up. */
const WING_UV = {
  root: [0.03, 0.26],
  elbow: [0.21, 0.03],
  wrist: [0.43, 0.09],
  knuckle: [
    [0.66, 0.02],
    [0.62, 0.26],
    [0.56, 0.5],
    [0.47, 0.74],
  ],
  tip: [
    [1.0, 0.05],
    [0.94, 0.32],
    [0.82, 0.6],
    [0.66, 0.86],
  ],
  anchorBody: [0.12, 0.8],
  anchorHip: [0.03, 0.97],
} as const;

/** one tapering bone: a cylinder whose axis runs along the group's +x, so a
 *  chain of `Group`s can be rotated at the joints like a real limb */
function bone(t: typeof THREE, len: number, r0: number, r1: number, color: number, seg = 8) {
  const m = cyl(t, r1, r0, len, color, [len / 2, 0, 0], { rotZ: Math.PI / 2, tex: 'concrete', repeat: [1, 2], rough: 0.85, bump: 0.05, seg });
  return m;
}

/**
 * THE WYRM — a full articulated beast whose body is the vehicle.
 *
 * Built as 11 independent `Group` segments so the ride's own spline runner can
 * place each one at its own arc-length offset (`uHead − i·spacing/total`): the
 * flex comes out of the TRACK FRAMES, not out of a canned animation. The
 * updater adds a phase-lagged travelling wave on top, drives the wing beat
 * (bones + a per-frame-rebuilt membrane), the jaw, the limbs, the eye glow and
 * the breath.
 */
export function buildWyrmDragon(t: typeof THREE, opts: WyrmDragonOpts = {}): WyrmDragonBuilt {
  const group = new t.Group();
  const segments: THREE.Group[] = [];
  const seatAnchors: THREE.Object3D[] = [];
  const glowMats: THREE.MeshStandardMaterial[] = [];

  const hideMat = (color: number, repeat: [number, number]) =>
    mat(t, color, { tex: 'concrete', repeat, rough: 0.78, bump: 0.09 });

  // ---- 1. THE BODY: eleven segments of scaled hide ------------------------
  for (let i = 0; i < N_SEG; i++) {
    const s = new t.Group();
    const r = SEG_R[i];
    const rNext = SEG_R[Math.min(N_SEG - 1, i + 1)];
    const cy = SPINE_Y + SEG_LIFT[i];
    // the vertebra itself: a tapering barrel along the segment's +z (forward),
    // deliberately LONGER than the spacing so the joints can never gap open
    const barrel = new t.Mesh(
      new t.CylinderGeometry(r, rNext, SEG_SPACING * 1.24, 14, 1),
      hideMat(i > 6 ? WYRM.flank : WYRM.back, [3, 2]),
    );
    barrel.rotation.x = Math.PI / 2; // +y axis → +z
    barrel.position.set(0, cy, -SEG_SPACING * 0.1);
    barrel.scale.set(i >= 3 && i <= 6 ? 1.12 : 1.0, 1, 1); // the ridden barrel is broader
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    s.add(barrel);
    // joint ball at the segment's own origin — hides the seam under flex
    s.add(ball(t, r * 1.02, WYRM.back, [0, cy, SEG_SPACING * 0.42], { tex: 'concrete', repeat: [2, 2], rough: 0.78, bump: 0.09 }));

    // the DORSAL RIDGE — tapered horn SPIKES raked back down the spine, three
    // per segment, tallest over the shoulders. (Round 1 built these as merged
    // BOXES and they read as a row of signboards bolted to the back: a dragon's
    // ridge has to come to a point.)
    for (let k = 0; k < 3; k++) {
      const f = (k + 0.5) / 3;
      // taller and PALER than round 8's: from the park's ~50° camera the ridge
      // is one of only three things you see of the beast (ridge, wings, head),
      // and 0x4a4c46 keratin over 0x3f5330 moss is the same value as the ground
      const sail = i >= 2 && i <= 6 ? 1.55 : 1.12; // the shoulder/barrel sail
      const h = (0.085 + r * 0.72) * sail * (i === 0 ? 0.55 : 1) * (0.82 + hash01(i * 7.3 + k * 2.1) * 0.36);
      const spike = cyl(t, 0.004, 0.03 + r * 0.11, h, k === 1 ? WYRM.bone : WYRM.hornDark, [0, cy + r * 0.9 + h * 0.44, SEG_SPACING * (0.42 - f * 1.0)], {
        tex: 'concrete',
        repeat: [1, 1],
        rough: 0.68,
        bump: 0.05,
        rotX: -0.3 - f * 0.06,
        seg: 6,
      });
      spike.scale.z = 1.9; // a blade, not a needle — it reads from the side
      s.add(spike);
    }

    // FLANK SHINGLES — overlapping plates so the hide reads SCALED close up
    const shingles: MergedBoxSpec[] = [];
    for (let k = 0; k < 10; k++) {
      const row = k % 2;
      const f = ((k >> 1) + 0.5) / 5;
      const th = 0.8 + row * 0.52 + (hash01(i * 3.1 + k) - 0.5) * 0.22; // polar angle off the top
      const zz = SEG_SPACING * (0.4 - f * 0.95);
      [-1, 1].forEach((sx) => {
        shingles.push({
          dims: [0.018, 0.09 + r * 0.22, 0.15 + r * 0.28],
          pos: [sx * Math.sin(th) * (r + 0.005) * (i >= 3 && i <= 6 ? 1.12 : 1), cy + Math.cos(th) * (r + 0.005), zz],
          rotZ: sx * th,
          rotX: -0.12,
        });
      });
    }
    const shingleMesh = mergedBoxes(t, shingles, WYRM.shingle, { tex: 'concrete', repeat: [1, 1], rough: 0.72, bump: 0.07 });
    shingleMesh.userData.lodDetail = true; // close-up only
    s.add(shingleMesh);

    // OXBLOOD BELLY SCUTES — transverse plates, the classic reptile underside
    if (i < 9) {
      const belly: MergedBoxSpec[] = [];
      for (let k = 0; k < 3; k++) {
        const f = (k + 0.5) / 3;
        belly.push({
          dims: [r * 0.92, 0.032, 0.12 + r * 0.2],
          pos: [0, cy - r * 1.0, SEG_SPACING * (0.4 - f * 0.95)],
        });
      }
      s.add(mergedBoxes(t, belly, WYRM.belly, { tex: 'concrete', repeat: [2, 1], rough: 0.8, bump: 0.04 }));
    }

    // ---- THE CHEST KEEL. A uniform barrel reads as a pipe with legs; a
    // dragon has a DEEP chest under the wing roots and a tucked waist behind
    // it. Segments 3-4 carry a keel mass hung under the barrel.
    if (i === 3 || i === 4) {
      const keel = new t.Mesh(new t.CylinderGeometry(r * 0.98, r * 0.66, SEG_SPACING * 1.2, 10, 1), hideMat(WYRM.flank, [2, 2]));
      keel.rotation.x = Math.PI / 2;
      keel.position.set(0, cy - r * 0.5, -SEG_SPACING * 0.08);
      keel.scale.set(1.06, 0.92, 1);
      keel.castShadow = true;
      s.add(keel);
      // the breast plate: big oxblood scutes across the front of the chest
      const br: MergedBoxSpec[] = [];
      for (let k = 0; k < 3; k++)
        br.push({ dims: [r * 1.24, 0.04, 0.17], pos: [0, cy - r * 1.28 + k * 0.02, SEG_SPACING * (0.36 - k * 0.34)], rotX: -0.05 });
      s.add(mergedBoxes(t, br, WYRM.belly, { tex: 'concrete', repeat: [2, 1], rough: 0.8, bump: 0.05 }));
    }

    // ---- SADDLES: where the riders go, either side of the dorsal ridge ----
    if (SADDLE_SEGS.includes(i)) {
      [-1, 1].forEach((sx) => {
        const px = sx * SADDLE_X;
        // leather pad
        s.add(box(t, [0.25, 0.05, 0.36], WYRM.saddle, [px, SADDLE_TOP - 0.025, 0], { tex: 'fabric', repeat: [2, 2], rough: 0.9 }));
        // back rest, low — this is a family coaster on a living animal
        s.add(box(t, [0.26, 0.16, 0.05], WYRM.saddle, [px, SADDLE_TOP + 0.08, -0.2], { tex: 'fabric', repeat: [2, 1], rough: 0.9 }));
        // HORN grab bar across the thighs, on two stubs off the pad
        s.add(cyl(t, 0.016, 0.016, 0.28, WYRM.horn, [px, SADDLE_TOP + 0.11, 0.17], { rotZ: Math.PI / 2, rough: 0.6, seg: 8 }));
        s.add(cyl(t, 0.012, 0.012, 0.11, WYRM.hornDark, [px, SADDLE_TOP + 0.06, 0.17], { rough: 0.6, seg: 6 }));
        const anchor = new t.Group();
        anchor.position.set(px, SEAT_ANCHOR_Y, 0);
        s.add(anchor);
        seatAnchors.push(anchor);
      });
      // girth strap under the barrel, tying the saddles to the beast
      s.add(box(t, [SEG_R[i] * 2.34, 0.03, 0.1], WYRM.saddle, [0, cy, 0.02], { tex: 'fabric', repeat: [3, 1], rough: 0.9 }));
    }

    s.position.set(0, 0, -i * SEG_SPACING); // standalone rest pose
    group.add(s);
    segments.push(s);
  }

  // decorative riders — dropped when the GameManager seats real guests
  if (opts.riders !== false) {
    seatAnchors.forEach((a, i) => {
      const p = buildPeep(t, {
        skin: SKIN_TONES[i % SKIN_TONES.length],
        shirt: SHIRTS[(i * 3 + 1) % SHIRTS.length],
        female: i % 3 === 1,
        seated: true,
        expression: i < 2 ? 'surprised' : 'happy',
      });
      p.group.scale.setScalar(0.5);
      p.group.userData.lodDetail = true;
      a.add(p.group);
    });
  }

  // ---- 2. THE REARING NECK + THE HEAD ------------------------------------
  // A dragon carries its head HIGH, and a lead segment whose barrel simply sits
  // on the rails reads as a crocodile (round 1 did exactly that). The rise
  // cannot come from the segment lifts — a step bigger than the joint ball
  // cracks the body open — so segment 0 carries a four-bone NECK RISER that
  // arcs up and forward, with the skull on top of it.
  //
  // ROUND 9: the arch was not enough. Four 0.15 bones at −0.22 rad carried the
  // skull only 0.30 above the segment origin, so from the park's ~50° camera the
  // beast read as a low WYVERN with its chin on the rails — a dragon-shaped
  // train. FIVE 0.175 bones at −0.27 rad carry it 0.57 up for the SAME 0.55 of
  // forward reach: the neck is now a real S-curve rearing out of the shoulders,
  // which is the single biggest change to the silhouette from above.
  let neckNode: THREE.Object3D = new t.Group();
  (neckNode as THREE.Group).position.set(0, SPINE_Y + SEG_LIFT[0], 0.2);
  segments[0].add(neckNode);
  for (let k = 0; k < 5; k++) {
    const len = 0.175;
    const r0 = 0.14 - k * 0.008;
    const seg = new t.Group();
    seg.rotation.x = -0.27; // every joint tilts the same way: the neck ARCS
    neckNode.add(seg);
    const vert = new t.Mesh(new t.CylinderGeometry(r0 - 0.007, r0, len * 1.32, 10, 1), hideMat(WYRM.back, [2, 2]));
    vert.rotation.x = Math.PI / 2;
    vert.position.set(0, 0, len / 2);
    vert.castShadow = true;
    seg.add(vert);
    seg.add(ball(t, r0 * 0.99, WYRM.back, [0, 0, 0], { tex: 'concrete', repeat: [1, 1], rough: 0.78, bump: 0.09 }));
    // the dorsal ridge CARRIES ON up the neck to the skull
    const sh = 0.09 + r0 * 0.72;
    const sp = cyl(t, 0.004, 0.022 + r0 * 0.1, sh, k % 2 ? WYRM.bone : WYRM.horn, [0, r0 * 0.86 + sh * 0.44, len * 0.4], {
      tex: 'concrete',
      repeat: [1, 1],
      rough: 0.68,
      bump: 0.05,
      rotX: -0.3,
      seg: 6,
    });
    sp.scale.z = 1.8;
    seg.add(sp);
    // oxblood throat scutes down the front of the neck
    seg.add(box(t, [r0 * 1.1, 0.03, len * 0.8], WYRM.belly, [0, -r0 * 0.95, len * 0.45], { tex: 'concrete', repeat: [1, 1], rough: 0.8, bump: 0.04 }));
    const nxt = new t.Group();
    nxt.position.set(0, 0, len);
    seg.add(nxt);
    neckNode = nxt;
  }
  /** the skull's own pitch, cancelling the neck's accumulated −1.35 rad: the
   *  muzzle ends up carried just nose-down of level, on top of a reared neck */
  const HEAD_PITCH = 1.47;
  const head = new t.Group();
  head.position.set(0, 0.02, 0.1);
  head.rotation.x = HEAD_PITCH;
  // ROUND 9: 1.32 was too small. The head is the whole character of the beast
  // and at park distance it was a dark green thumb on the end of a hose; the
  // skull has to out-mass the neck it sits on by a clear margin.
  head.scale.setScalar(1.62);
  neckNode.add(head);
  const nostrils: THREE.Object3D[] = [];
  const jaw = new t.Group();
  {
    const HM = () => hideMat(WYRM.skull, [2, 2]);
    // cranium — a wedge, wide at the cheeks and narrowing to the brow
    const skull = new t.Mesh(new t.CylinderGeometry(0.125, 0.165, 0.34, 14, 1), HM());
    skull.rotation.x = Math.PI / 2;
    skull.position.set(0, 0.005, 0.02);
    skull.scale.set(1.42, 1.08, 1); // BROADER across the temples than round 8
    head.add(skull);
    // the OCCIPUT — the mass behind the jaw hinge that makes a skull a skull
    head.add(ball(t, 0.12, WYRM.skull, [0, 0.01, -0.13], { tex: 'concrete', repeat: [1, 1], rough: 0.78, bump: 0.08 }));
    // SNOUT, tapering to the nose — the muzzle is the LIGHTEST hide on the
    // beast on purpose: round 8 built it out of `flank` and the whole front of
    // the skull disappeared into shadow whenever the sun was off to one side
    const snout = new t.Mesh(new t.CylinderGeometry(0.078, 0.135, 0.33, 14, 1), hideMat(WYRM.muzzle, [2, 2]));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.03, 0.3);
    snout.scale.set(1.22, 0.94, 1);
    head.add(snout);
    // the NOSE: broad enough to cap the snout's front face, or the cylinder's
    // flat end cap shows as a dark wall straight down the muzzle
    const nose = ball(t, 0.086, WYRM.muzzle, [0, -0.03, 0.452], { tex: 'concrete', repeat: [1, 1], rough: 0.78, bump: 0.08 });
    nose.scale.set(1.14, 0.94, 0.9);
    head.add(nose);
    // ---- the UPPER JAW. Round 8 hung a straight 0.222 × 0.36 SLAB under the
    // snout, and a rectangular prism is exactly what made the muzzle read as a
    // box with panels glued on. A tapering barrel instead: wide and shallow at
    // the hinge, narrowing to the nose, so the whole muzzle is a wedge.
    const upperJaw = new t.Mesh(new t.CylinderGeometry(0.064, 0.116, 0.38, 12, 1), hideMat(WYRM.muzzle, [2, 2]));
    upperJaw.rotation.x = Math.PI / 2;
    upperJaw.position.set(0, -0.072, 0.3);
    upperJaw.scale.set(1.34, 0.6, 1); // the tooth-bearing gum line
    head.add(upperJaw);
    // the NASAL BRIDGE: a faceted keratin ridge running the length of the snout
    // between the nasal crests — the line that gives a muzzle a profile
    head.add(
      cyl(t, 0.016, 0.038, 0.3, WYRM.bone, [0, 0.026, 0.32], {
        rotX: Math.PI / 2 - 0.08,
        tex: 'concrete',
        repeat: [1, 2],
        rough: 0.72,
        bump: 0.05,
        seg: 5,
        flat: true,
      }),
    );

    // BROW RIDGES — the single most important read on a dragon head, and now
    // built HEAVY and in pale bone: a brooding overhang the eye sits under,
    // which is the whole difference between a lizard and a dragon
    [-1, 1].forEach((sx) => {
      // SET LOW AND CANTED HARD OVER THE SOCKET. The first round-9 try built
      // this 0.105 x 0.25 and sat it at y 0.098 on the midline side of the
      // skull: at queue distance the two of them plus the crown crest fused
      // into one pale PLANK laid across the head. A brow is a hood.
      head.add(box(t, [0.078, 0.06, 0.17], WYRM.bone, [sx * 0.128, 0.078, 0.138], { rotZ: sx * 0.46, rotX: -0.2, tex: 'concrete', repeat: [1, 2], rough: 0.7, bump: 0.06 }));
      // the ridge carries forward into a nasal crest over the snout
      head.add(box(t, [0.055, 0.045, 0.17], WYRM.muzzle, [sx * 0.078, 0.04, 0.3], { rotZ: sx * 0.5, rotX: 0.12, tex: 'concrete', repeat: [1, 2], rough: 0.72, bump: 0.06 }));
      // cheek plate over the jaw hinge
      head.add(box(t, [0.044, 0.115, 0.145], WYRM.muzzle, [sx * 0.178, -0.026, 0.05], { rotZ: -sx * 0.26, rotX: 0.1, tex: 'concrete', repeat: [1, 2], rough: 0.8, bump: 0.07 }));
      // the MAXILLA: a bone ridge down the side of the muzzle, which is what
      // stops the snout reading as a smooth cone. Slimmer and set HIGHER than
      // round 8's flat panel, and yawed in to follow the taper, so it reads as
      // a cheekbone rather than a rectangle stuck on the side of the face.
      head.add(box(t, [0.02, 0.038, 0.22], WYRM.muzzle, [sx * 0.129, -0.02, 0.3], { rotZ: -sx * 0.18, rotY: sx * 0.15, tex: 'concrete', repeat: [1, 3], rough: 0.82, bump: 0.07 }));
    });
    // bony CREST between the brows, running back over the crown
    const crest: MergedBoxSpec[] = [];
    for (let k = 0; k < 5; k++) {
      const f = k / 4;
      crest.push({ dims: [0.05, 0.055 + f * 0.075, 0.09], pos: [0, 0.108 + f * 0.028, 0.095 - f * 0.27], rotX: -0.2 });
    }
    head.add(mergedBoxes(t, crest, WYRM.bone, { tex: 'concrete', repeat: [1, 1], rough: 0.7, bump: 0.05 }));

    // HORNS — five tapering segments each, sweeping up and BACK off the crown
    [-1, 1].forEach((sx) => {
      let node = new t.Group();
      node.position.set(sx * 0.085, 0.1, -0.04);
      // RAKED HARDER BACK than round 8 (−0.42): with the skull now 60% bigger
      // and carried 0.27 higher on a reared neck, upright horns put the tip over
      // the tower breach's 1.95 clear height — and a horn that lies BACK along
      // the neck is the better silhouette anyway.
      node.rotation.set(-0.62, sx * 0.3, 0);
      head.add(node);
      for (let k = 0; k < 5; k++) {
        const len = 0.155 - k * 0.014;
        const r0 = 0.034 - k * 0.0052;
        const seg = new t.Group();
        // the SWEEP: every joint bends the SAME way the root is tilted, so the
        // horn arcs up and BACK over the neck (round 1 bent them forward and
        // they read as two smooth tusks growing out of the skull)
        seg.rotation.set(-0.2, 0, 0);
        node.add(seg);
        // the horn segments run along the joint's +y (bone() lies along +x)
        // 5 radial segments: faceted, so it reads as KERATIN and not as a pipe
        // PALE at the root and darkening to the point: slate keratin against
        // mossy ground is the same value as the ground from a high camera
        seg.add(cyl(t, r0 * 0.68, r0 * 1.04, len, k > 2 ? WYRM.horn : WYRM.bone, [0, len / 2, 0], { tex: 'concrete', repeat: [1, 2], rough: 0.72, bump: 0.06, seg: 5, flat: true }));
        const nxt = new t.Group();
        nxt.position.set(0, len, 0);
        seg.add(nxt);
        node = nxt;
      }
      // a SECOND, smaller horn pair outboard of the mains
      head.add(cyl(t, 0.003, 0.023, 0.19, WYRM.horn, [sx * 0.128, 0.07, -0.02], { rotZ: sx * 0.6, rotX: -0.85, rough: 0.7, seg: 6 }));
      // CHEEK SPIKE and jaw spines
      head.add(cyl(t, 0.004, 0.028, 0.14, WYRM.bone, [sx * 0.145, -0.01, -0.05], { rotZ: sx * 0.9, rotX: -0.4, rough: 0.7, seg: 6 }));
      head.add(cyl(t, 0.004, 0.019, 0.1, WYRM.horn, [sx * 0.125, -0.06, 0.02], { rotZ: sx * 1.2, rotX: -0.2, rough: 0.7, seg: 6 }));
    });
    // NECK FRILL — a fan of spines where the skull meets the neck
    for (let k = 0; k < 5; k++) {
      const f = (k / 4 - 0.5) * 2; // -1..1
      head.add(
        cyl(t, 0.004, 0.024, 0.16 + (1 - Math.abs(f)) * 0.09, k % 2 ? WYRM.bone : WYRM.horn, [f * 0.11, 0.05 - Math.abs(f) * 0.06, -0.14], {
          rotZ: f * 0.9,
          rotX: -0.75,
          rough: 0.72,
          seg: 6,
        }),
      );
    }

    // EYES — deep amber, set under the brow. Day-AND-night lerped (a dragon's
    // eyes are lit from inside; they never gate to zero).
    [-1, 1].forEach((sx) => {
      // the eye sits PROUD of its socket — round 1 buried a 0.032 eyeball
      // inside a 0.043 socket sphere and the beast read as blind
      // the eye sits in a bony socket with the brow over it, PROUD but not
      // bulging: round 4 put a 0.042 emissive ball out on the cheek and it read
      // as a lollipop bolted to the skull
      // PALE socket bone, so the amber has something bright to sit against and
      // the eye is still findable when the whole head is in shadow
      head.add(ball(t, 0.055, WYRM.bone, [sx * 0.125, 0.038, 0.15], { rough: 0.62 })); // socket bone
      const e = ball(t, 0.036, WYRM.eye, [sx * 0.152, 0.042, 0.166], { emissive: WYRM.eye, rough: 0.25 });
      (e.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.95;
      head.add(e);
      glowMats.push(e.material as THREE.MeshStandardMaterial);
      // vertical SLIT pupil across the glow — reads as a reptile eye
      head.add(box(t, [0.012, 0.05, 0.012], 0x18120a, [sx * 0.174, 0.042, 0.172], { rotZ: sx * 0.34, rough: 0.4 }));
      // eyelid hood, so the eye is set INTO the head
      head.add(box(t, [0.066, 0.032, 0.082], WYRM.skull, [sx * 0.142, 0.076, 0.156], { rotZ: sx * 0.34, tex: 'concrete', repeat: [1, 1], rough: 0.8, bump: 0.06 }));
    });

    // NOSTRILS — the breath origins
    [-1, 1].forEach((sx) => {
      head.add(cyl(t, 0.019, 0.03, 0.03, 0x241d16, [sx * 0.042, 0.0, 0.455], { rotX: Math.PI / 2 - 0.4, rough: 0.7, seg: 8 }));
      const n = new t.Object3D();
      n.position.set(sx * 0.042, 0.01, 0.5);
      head.add(n);
      nostrils.push(n);
    });

    // TEETH — upper row hanging out of the gum ridge
    const toothRow = (parent: THREE.Object3D, dir: 1 | -1, y: number) => {
      for (let k = 0; k < 7; k++) {
        const f = k / 6;
        const hx = hash01(k * 4.3 + (dir > 0 ? 1 : 7));
        const h = (0.042 + (1 - f) * 0.038) * (0.8 + hx * 0.4);
        [-1, 1].forEach((sx) => {
          const tooth = cyl(t, 0.001, 0.015 + (1 - f) * 0.006, h, WYRM.tooth, [sx * (0.095 - f * 0.038), y - dir * h * 0.5, 0.14 + f * 0.3], {
            rotX: dir > 0 ? Math.PI : 0,
            rough: 0.45,
            seg: 5,
          });
          parent.add(tooth);
        });
      }
    };
    toothRow(head, 1, -0.088);

    // ---- THE HINGED LOWER JAW -------------------------------------------
    jaw.position.set(0, -0.075, 0.03);
    head.add(jaw);
    const jawBar = new t.Mesh(new t.CylinderGeometry(0.062, 0.128, 0.45, 12, 1), hideMat(WYRM.muzzle, [2, 2]));
    jawBar.rotation.x = Math.PI / 2;
    jawBar.position.set(0, -0.03, 0.235);
    jawBar.scale.set(1.2, 0.92, 1); // DEEPER than round 8's 0.72: a jaw, not a strap
    jaw.add(jawBar);
    // the MANDIBLE ANGLE — the heavy flare at the back of the jaw that carries
    // the bite muscle. Without it a dragon's profile has no chin and no bite.
    [-1, 1].forEach((sx) => {
      jaw.add(box(t, [0.055, 0.115, 0.155], WYRM.muzzle, [sx * 0.135, -0.02, 0.035], { rotZ: sx * 0.14, tex: 'concrete', repeat: [1, 2], rough: 0.8, bump: 0.07 }));
      jaw.add(cyl(t, 0.004, 0.02, 0.11, WYRM.horn, [sx * 0.15, -0.055, 0.02], { rotZ: sx * 1.35, rotX: -0.25, rough: 0.7, seg: 6 }));
    });
    jaw.add(box(t, [0.165, 0.04, 0.37], WYRM.belly, [0, -0.062, 0.225], { tex: 'concrete', repeat: [2, 2], rough: 0.85, bump: 0.05 })); // throat
    // chin barbels — two short horn spikes under the jaw
    [-1, 1].forEach((sx) =>
      jaw.add(cyl(t, 0.003, 0.015, 0.115, WYRM.horn, [sx * 0.052, -0.082, 0.31], { rotX: 0.5, rotZ: sx * 0.3, rough: 0.7, seg: 6 })),
    );
    toothRow(jaw, -1, -0.005);
  }

  // ---- 3. THE WINGS ------------------------------------------------------
  interface WingRig {
    root: THREE.Group;
    shoulder: THREE.Group;
    elbow: THREE.Group;
    wrist: THREE.Group;
    fingers: { base: THREE.Group; tip: THREE.Group; joints: THREE.Object3D[] }[];
    membrane: THREE.Mesh;
    tris: [THREE.Object3D | null, THREE.Object3D | null, THREE.Object3D | null][];
    /** per-vertex billow weight, straight off the chart's CHORD coordinate: the
     *  free trailing edge bags, the taut leading edge on the finger bones does
     *  not. Round 8 sagged by corner INDEX (`k === 0 ? 0.15 : 0.55`), which is
     *  an arbitrary vertex within each triangle and creased the wing at random. */
    sag: Float32Array;
    /** per control triangle × slot (0-2 corners, 3-5 edge midpoints): the extra
     *  downward bow that turns each flat panel into a curved sheet */
    bow: Float32Array;
    /** per control triangle × slot: the inward pull that scallops the trailing
     *  edge between the fingers */
    scallop: Float32Array;
    /** the subdivision tables — see the comment where they are built */
    sub: [number, number, number][];
    slot: [number, number][];
    /** per-frame scratch for the six slot positions (no allocation in update) */
    cx: Float32Array;
    cy: Float32Array;
    cz: Float32Array;
    sign: number;
    /** +1 starboard, −1 port: the sign every yaw/twist in the beat is
     *  multiplied by, because the port root is yawed a half turn */
    mir: number;
  }
  const wings: WingRig[] = [];
  // ---- the MEMBRANE material: thin veined skin, not a leather sheet -------
  const memCan = membraneCanvases();
  const memTex = (c: HTMLCanvasElement, srgb: boolean) => {
    const tx = new t.CanvasTexture(c);
    // the chart is 0..1 in both axes — CLAMP, never repeat (a repeat wraps the
    // trailing hem back onto the leading edge)
    tx.wrapS = tx.wrapT = t.ClampToEdgeWrapping;
    tx.anisotropy = 4;
    if (srgb) (tx as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
    return tx;
  };
  const membraneMat = new t.MeshStandardMaterial({
    color: 0xffffff,
    map: memTex(memCan.albedo, true),
    bumpMap: memTex(memCan.bump, false),
    bumpScale: 0.035,
    roughness: 0.88, // skin, and there is NO env map on this Stage: no gloss
    metalness: 0,
    // the THIN-SKIN read: a warm emissive MASKED by the glow map, so the light
    // "comes through" the panel middles while the veins, the root and the
    // trailing hem stay dark. This also keeps the underside — which is in the
    // wing's own shadow all day — from reading as a black rag.
    emissive: new t.Color(WYRM.membraneLit),
    emissiveMap: memTex(memCan.glow, true),
    emissiveIntensity: 0.42,
    side: t.DoubleSide,
  });
  [-1, 1].forEach((sx) => {
    const root = new t.Group();
    // mounted HIGH on the shoulders — above the saddles, so the wing roots read
    // as the top of the beast from a park camera looking down
    root.position.set(sx * 0.19, SPINE_Y + 0.36, 0.06);
    segments[3].add(root);
    // shoulder muscle mass over the joint
    root.add(ball(t, 0.09, WYRM.back, [sx * 0.03, 0, 0], { tex: 'concrete', repeat: [1, 1], rough: 0.78, bump: 0.08 }));

    // the bone chain. Each joint is a Group; bone() geometry runs along +x, so
    // the RIGHT wing (sx=+1) reaches out along +x and the left is mirrored by
    // the root's scale.
    const shoulder = new t.Group();
    root.add(shoulder);
    shoulder.add(bone(t, 0.56, 0.052, 0.038, 0x323d2b));
    const elbow = new t.Group();
    elbow.position.set(0.56, 0, 0);
    shoulder.add(elbow);
    elbow.add(ball(t, 0.038, WYRM.flank, [0, 0, 0], { rough: 0.8 }));
    elbow.add(bone(t, 0.52, 0.038, 0.03, 0x323d2b));
    const wrist = new t.Group();
    wrist.position.set(0.52, 0, 0);
    elbow.add(wrist);
    wrist.add(ball(t, 0.032, WYRM.flank, [0, 0, 0], { rough: 0.8 }));
    // the WING CLAW on the wrist — the little hook a dragon walks on
    wrist.add(cyl(t, 0.002, 0.014, 0.075, WYRM.horn, [0.02, 0.03, 0.03], { rotX: -0.9, rough: 0.6, seg: 6 }));

    // FOUR FINGERS, two phalanges each, splaying back across the span
    // the fingers FAN: the leading one carries the wing outboard, the rest
    // rake back to pull the trailing edge onto the flank
    // The FAN is deliberately wide (0.34 → −1.20 rad, ~88°): the wing has to
    // read as a broad planform from the park's ~50° three-quarter camera, and
    // raking the trailing fingers BACK buys chord without buying span — which
    // matters, because the span is what has to pass the tower breach.
    const FING = [
      { l1: 0.52, l2: 0.48, yaw: 0.34 },
      { l1: 0.5, l2: 0.44, yaw: -0.1 },
      { l1: 0.44, l2: 0.36, yaw: -0.58 },
      { l1: 0.37, l2: 0.3, yaw: -1.2 },
    ];
    const fingers = FING.map((f) => {
      const base = new t.Group();
      base.rotation.y = f.yaw * sx; // the splay (about the wing's own up axis)
      wrist.add(base);
      base.add(bone(t, f.l1, 0.026, 0.019, 0x323d2b, 6));
      const knuckle = new t.Group();
      knuckle.position.set(f.l1, 0, 0);
      base.add(knuckle);
      knuckle.add(ball(t, 0.02, WYRM.flank, [0, 0, 0], { rough: 0.8 }));
      const tip = new t.Group();
      knuckle.add(tip);
      tip.add(bone(t, f.l2, 0.018, 0.009, 0x323d2b, 6));
      const end = new t.Object3D();
      end.position.set(f.l2, 0, 0);
      tip.add(end);
      return { base, tip, joints: [knuckle, end] as THREE.Object3D[] };
    });

    // the MEMBRANE — rebuilt from the live bone tips every frame
    // the trailing edge anchors on the flank BEHIND the shoulder. The left
    // wing's root is yawed a half turn (see below), so its local +z points
    // forward — hence the `* sx` on every z offset.
    // pushed further down the flank than round 8 had them: the trailing edge
    // sweeping back onto the HIP is most of the wing's visible area from above
    const anchorBody = new t.Object3D();
    anchorBody.position.set(-0.06, -0.23, -0.46 * sx);
    root.add(anchorBody);
    const anchorHip = new t.Object3D();
    anchorHip.position.set(-0.02, -0.3, -0.92 * sx);
    root.add(anchorHip);
    const tips = fingers.map((f) => f.joints[1]);
    const knuckles = fingers.map((f) => f.joints[0]);
    // panel list: propatagium (shoulder→elbow→wrist), the four inter-finger
    // panels (each split at the knuckle so it CREASES), and the trailing
    // panels back onto the body
    const tris: WingRig['tris'] = [
      [null, elbow, wrist], // propatagium: root → elbow → wrist
      [wrist, tips[0], knuckles[0]],
      [wrist, knuckles[0], knuckles[1]],
      [knuckles[0], tips[0], tips[1]],
      [knuckles[0], tips[1], knuckles[1]],
      [wrist, knuckles[1], knuckles[2]],
      [knuckles[1], tips[1], tips[2]],
      [knuckles[1], tips[2], knuckles[2]],
      [wrist, knuckles[2], knuckles[3]],
      [knuckles[2], tips[2], tips[3]],
      [knuckles[2], tips[3], knuckles[3]],
      [wrist, knuckles[3], anchorBody],
      [knuckles[3], tips[3], anchorBody],
      [tips[3], anchorHip, anchorBody],
    ];
    // ---- REAL UVs off the anatomical chart. Round 8 wrote
    // `u = (k % 3) * 0.5`, which gave two of every triangle's three corners the
    // SAME u — degenerate, so no map could ever have shown on the membrane.
    // Every corner now gets its own (span, chord) coordinate, which is what
    // makes the vein fan and the edge darkening land where they belong.
    const chartOf = new Map<THREE.Object3D, readonly [number, number]>();
    chartOf.set(elbow, WING_UV.elbow);
    chartOf.set(wrist, WING_UV.wrist);
    knuckles.forEach((k, i) => chartOf.set(k, WING_UV.knuckle[i]));
    tips.forEach((k, i) => chartOf.set(k, WING_UV.tip[i]));
    chartOf.set(anchorBody, WING_UV.anchorBody);
    chartOf.set(anchorHip, WING_UV.anchorHip);
    const chartUV = (o: THREE.Object3D | null) => (o === null ? WING_UV.root : chartOf.get(o) ?? WING_UV.wrist);
    /** the billow weight IS the chord coordinate, eased so the middle of the
     *  panel bags most and the trailing hem is held by its own tension */
    const sagOf = (c: readonly [number, number]) =>
      Math.sin(Math.min(1, c[1] * 1.15) * Math.PI * 0.86) * (0.4 + 0.6 * Math.min(1, c[0] * 1.6));

    // ---- ONE SUBDIVISION, and this is the other half of the cardboard fix.
    // A membrane stretched as 14 FLAT triangles between straight bones cannot
    // look like skin: it has no curvature, so every panel takes one flat shade
    // and reads as a cut-out. Each control triangle is split into four on its
    // edge midpoints, and the midpoints are pushed DOWN beyond the straight
    // chord (by the geometric mean of the endpoints' sag weight, so an edge with
    // one end pinned to a bone still bows but less). The panel becomes a curved
    // sheet, `computeVertexNormals` shades it as one, and the wing catches the
    // sun across it instead of flashing one flat value.
    //   slot 0,1,2 = the control corners · 3,4,5 = the midpoints of 01, 12, 20
    const SUB: [number, number, number][] = [
      [0, 3, 5],
      [3, 1, 4],
      [5, 4, 2],
      [3, 4, 5],
    ];
    const SLOT: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [0, 1],
      [1, 2],
      [2, 0],
    ];
    const nOut = tris.length * SUB.length; // 56 triangles a wing
    const geo = new t.BufferGeometry();
    geo.setAttribute('position', new t.BufferAttribute(new Float32Array(nOut * 9), 3));
    const uv = new Float32Array(nOut * 6);
    /** per control triangle × slot: the slot's extra downward bow, over and
     *  above the linear interpolation of its endpoints' sag */
    const bow = new Float32Array(tris.length * 6);
    /** per control triangle × slot: how far a free-margin midpoint is drawn in
     *  toward the panel centroid — the trailing edge's scallops */
    const scallop = new Float32Array(tris.length * 6);
    /** per control-triangle corner: the corner's own sag weight */
    const sag = new Float32Array(tris.length * 3);
    tris.forEach((tri, i) => {
      const cu = tri.map((o) => chartUV(o));
      const cs = cu.map((c) => sagOf(c));
      cs.forEach((v, k) => {
        sag[i * 3 + k] = v;
      });
      SLOT.forEach(([a, b], slot) => {
        bow[i * 6 + slot] = a === b ? 0 : 0.62 * Math.sqrt(cs[a] * cs[b]);
        // SCALLOP: where BOTH ends of an edge sit on the outboard free margin
        // (chord past 0.28, span past 0.55) the midpoint is also pulled in
        // toward the panel's centroid, so the trailing edge comes out as a row
        // of concave scallops between the fingers instead of a straight cut —
        // the single strongest membranous-wing cue there is.
        scallop[i * 6 + slot] =
          a !== b && Math.min(cu[a][1], cu[b][1]) > 0.28 && Math.min(cu[a][0], cu[b][0]) > 0.55 ? 0.2 : 0;
      });
      SUB.forEach((face, f) => {
        face.forEach((slot, k) => {
          const [a, b] = SLOT[slot];
          const vi = (i * SUB.length + f) * 3 + k;
          uv[vi * 2] = (cu[a][0] + cu[b][0]) * 0.5;
          uv[vi * 2 + 1] = (cu[a][1] + cu[b][1]) * 0.5;
        });
      });
    });
    geo.setAttribute('uv', new t.BufferAttribute(uv, 2));
    const membrane = new t.Mesh(geo, membraneMat);
    membrane.frustumCulled = false;
    membrane.castShadow = true;
    root.add(membrane);
    // MIRROR by YAW, never by a negative scale (a −1 scale inverts every
    // normal in the rig and the lit bones read inside-out): the left root is
    // turned a half turn so its +x reaches out to port, and `mir` flips the
    // sign of every yaw/twist the beat applies inside it.
    if (sx < 0) root.rotation.y = Math.PI;

    wings.push({
      root,
      shoulder,
      elbow,
      wrist,
      fingers,
      membrane,
      tris,
      sag,
      bow,
      scallop,
      sub: SUB,
      slot: SLOT,
      cx: new Float32Array(6),
      cy: new Float32Array(6),
      cz: new Float32Array(6),
      sign: sx,
      mir: sx,
    });
  });

  // ---- 4. CLAWED LIMBS ---------------------------------------------------
  interface LegRig {
    hip: THREE.Group;
    knee: THREE.Group;
    ankle: THREE.Group;
    phase: number;
  }
  const legs: LegRig[] = [];
  ([[3, 1, 0.16], [3, -1, 0.16], [6, 1, 0.2], [6, -1, 0.2]] as [number, number, number][]).forEach(([segIdx, sx, thick], li) => {
    const fore = segIdx === 3;
    const hip = new t.Group();
    hip.position.set(sx * (SEG_R[segIdx] * 0.86), SPINE_Y - 0.05, fore ? -0.06 : 0.02);
    hip.rotation.set(fore ? 0.5 : -0.4, 0, sx * 0.5);
    segments[segIdx].add(hip);
    hip.add(ball(t, thick * 0.42, WYRM.flank, [0, 0, 0], { rough: 0.8 }));
    const uLen = fore ? 0.2 : 0.24;
    hip.add(cyl(t, thick * 0.3, thick * 0.4, uLen, WYRM.flank, [0, -uLen / 2, 0], { tex: 'concrete', repeat: [1, 2], rough: 0.82, bump: 0.06, seg: 8 }));
    const knee = new t.Group();
    knee.position.set(0, -uLen, 0);
    knee.rotation.x = fore ? -1.0 : 1.1; // folded, tucked up under the body
    hip.add(knee);
    knee.add(ball(t, thick * 0.3, WYRM.flank, [0, 0, 0], { rough: 0.8 }));
    knee.add(cyl(t, thick * 0.2, thick * 0.28, 0.18, WYRM.flank, [0, -0.09, 0], { tex: 'concrete', repeat: [1, 2], rough: 0.82, bump: 0.06, seg: 8 }));
    const ankle = new t.Group();
    ankle.position.set(0, -0.18, 0);
    ankle.rotation.x = fore ? 0.7 : -0.8;
    knee.add(ankle);
    // FOOT + three claws (and a spur behind)
    ankle.add(box(t, [thick * 0.62, 0.045, 0.11], WYRM.flank, [0, -0.02, 0.03], { tex: 'concrete', repeat: [1, 1], rough: 0.8, bump: 0.06 }));
    [-1, 0, 1].forEach((k) => {
      const claw = cyl(t, 0.002, 0.017, 0.085, WYRM.horn, [k * thick * 0.2, -0.035, 0.1], { rotX: 1.15 + k * 0.05, rotZ: k * 0.22, rough: 0.55, seg: 6 });
      ankle.add(claw);
    });
    ankle.add(cyl(t, 0.002, 0.012, 0.055, WYRM.hornDark, [0, -0.03, -0.04], { rotX: -1.0, rough: 0.55, seg: 5 }));
    legs.push({ hip, knee, ankle, phase: li * 1.7 });
  });

  // ---- 5. THE TAIL SPADE -------------------------------------------------
  {
    const tip = segments[N_SEG - 1];
    const spade = new t.Group();
    spade.position.set(0, SPINE_Y + SEG_LIFT[N_SEG - 1], -0.3);
    tip.add(spade);
    // a flat blade: two opposed tapered cones sharing a base ridge
    const blade = new t.Mesh(new t.CylinderGeometry(0.006, 0.17, 0.44, 6, 1), mat(t, WYRM.horn, { tex: 'concrete', repeat: [1, 1], rough: 0.7, bump: 0.06 }));
    blade.rotation.x = -Math.PI / 2;
    blade.position.set(0, 0, -0.2);
    blade.scale.set(1, 0.26, 1); // flattened into a spade
    blade.castShadow = true;
    spade.add(blade);
    const barb = new t.Mesh(new t.CylinderGeometry(0.005, 0.095, 0.19, 6, 1), mat(t, WYRM.hornDark, { rough: 0.7 }));
    barb.rotation.x = Math.PI / 2;
    barb.position.set(0, 0, 0.06);
    barb.scale.set(1, 0.3, 1);
    spade.add(barb);
    // side fins
    [-1, 1].forEach((sx) =>
      spade.add(box(t, [0.014, 0.075, 0.19], WYRM.horn, [sx * 0.07, 0.02, -0.13], { rotZ: sx * 0.4, rough: 0.7, tex: 'concrete', repeat: [1, 1], bump: 0.05 })),
    );
  }

  // ---- 6. the head light (amber: the eyes and the breath) ----------------
  const headLight = new t.PointLight(0xffb05a, 0, 3.4, 2);
  headLight.position.set(0, 0.02, 0.4);
  head.add(headLight);

  // ---- 7. THE BREATH: smoke and embers out of the nostrils ---------------
  // 180 particles of the component's 300 budget. The emitters live in whatever
  // space the caller parents `breathPoints` into (the ride group) so the smoke
  // is LEFT BEHIND as the beast runs, instead of riding along with the skull.
  const breath: Emitter[] = [];
  if (opts.breath !== false) {
    breath.push(
      buildEmitter(t, {
        max: 110,
        rate: 7,
        life: 2.2,
        lifeVar: 0.8,
        velocity: [0, 0.45, 0],
        spread: 0.32,
        gravity: -0.2, // buoyant
        size: 0.15,
        sizeEnd: 0.7,
        color: 0x5d5f54,
        colorEnd: 0x8e9186,
        opacity: 0.32,
      }),
      buildEmitter(t, {
        max: 70,
        rate: 6,
        life: 1.4,
        lifeVar: 0.6,
        velocity: [0, 0.6, 0],
        spread: 0.5,
        gravity: 0.35,
        size: 0.055,
        sizeEnd: 0.012,
        color: 0xffcf7a,
        colorEnd: 0x8f2a08,
        opacity: 0.95,
        additive: true,
      }),
    );
  }

  // =========================== THE ANIMATION ==============================
  const V = new t.Vector3();
  const M = new t.Matrix4();
  /** wing beat: 2.6 s a cycle — SLOW, and every joint lags the one before it,
   *  which is the whole difference between a wing and a rigid flap */
  const BEAT_W = (Math.PI * 2) / 2.6;

  const poseWing = (w: WingRig, clock: number, furl: number, effort: number) => {
    // the port wing runs 0.3 rad (5% of a cycle) behind the starboard one. In
    // motion that is imperceptible — real animals fly asymmetrically through a
    // turn anyway — but it guarantees the two wings are never at the same
    // extreme at the same instant, so a still frame of the beast always has at
    // least one wing well spread.
    const ph = clock * BEAT_W + (w.mir < 0 ? 0.3 : 0);
    const raw = Math.sin(ph);
    // SHAPED, not sinusoidal. A plain sine spends half its cycle near an
    // extreme, and near the top of the stroke a wing is edge-on: for half of
    // every beat the beast read as two folded sails rather than a spread wing.
    // Raising |sin| to 1.6 makes the stroke DWELL at the spread mid-pose and
    // pass quickly through the extremes — which is also what a big slow soaring
    // flap actually does, and what a photograph of one looks like.
    const s = Math.sign(raw) * Math.abs(raw) ** 1.6;
    const open = 1 - furl; // 1 = flying, 0 = folded against the flank
    // EFFORT deepens the stroke: the wyrm has no chain lift, it climbs the hill
    // itself, and on the way up it works for it
    const spread = open * effort;
    const m = w.mir;
    // ---- A GULL WING, not a flat plank and not a pair of vertical sails.
    //
    // Round 8 held ONE dihedral (0.46) all the way out the bone chain: a
    // straight board, which reads as a plank from the side and edge-on from
    // above. Simply raising that dihedral (round 9's first try) made it worse —
    // the whole wing stood up and read as two brown flags.
    //
    // So the DROOP IS TIED TO THE DIHEDRAL: the elbow gives back 0.52 of it and
    // the wrist another 0.34, which leaves the outer panel within ~0.15 rad of
    // level at EVERY point of the stroke. The shoulder therefore carries a hard
    // raised-shoulder silhouette from the side while the outer two thirds of the
    // wing — where nearly all of the membrane area is — stays turned FLAT ON to
    // the park's ~50° three-quarter camera. The beat then reads as the shoulder
    // working and the outer panel rippling, which is what a big slow soaring
    // flap actually looks like.
    //
    // It buys clearance too: the tip of a drooped wing off a high shoulder sits
    // LOWER than a straight wing at the same dihedral, and the tip is what has
    // to pass the tower breach (clear height 1.95 above the rails).
    // The numbers are the balance point between two failures that were both
    // rendered and rejected: droop the outer panel all the way to level and the
    // wings sink BELOW the dorsal ridge and read as a brown mat draped over the
    // beast; take the droop out and the whole wing stands up as a sail. A 0.85
    // shoulder with 0.65 of it given back down the chain puts the outer panel at
    // ~0.30 rad — a broad plane presented to a high camera that still sits
    // clearly ABOVE the body's own silhouette, which is what makes it read as a
    // wing at all.
    const dihedral = 0.85 + 0.4 * s * spread;
    w.shoulder.rotation.z = dihedral - furl * 1.5;
    w.shoulder.rotation.y = m * (-0.12 + 0.2 * Math.sin(ph - 0.6) * spread - furl * 0.9);
    w.shoulder.rotation.x = m * 0.1 * Math.cos(ph) * spread;
    // elbow lags 0.9 rad and FOLDS on the upstroke (a real wing shortens)
    const el = Math.sin(ph - 0.9);
    w.elbow.rotation.z = -0.4 * dihedral + 0.3 * el * spread;
    w.elbow.rotation.y = m * (-0.18 + 0.28 * el * spread - furl * 1.6);
    // wrist lags 1.4
    const wr = Math.sin(ph - 1.4);
    w.wrist.rotation.z = -0.25 * dihedral + 0.24 * wr * spread;
    w.wrist.rotation.y = m * (-0.12 + 0.22 * wr * spread - furl * 1.4);
    // fingers lag 1.8 and close up as the wing folds; the tips curl slightly
    // DOWN, which is what stops the planform reading as a flat kite
    w.fingers.forEach((f, k) => {
      const fp = Math.sin(ph - 1.8 - k * 0.16);
      f.base.rotation.z = 0.06 * fp * spread;
      f.tip.rotation.z = -0.16 + 0.22 * fp * spread;
      f.tip.rotation.y = m * (-0.1 - 0.14 * fp * spread - furl * 0.5);
      f.base.rotation.y = m * ([0.34, -0.1, -0.58, -1.2][k] as number) * (0.55 + 0.45 * open);
    });
    // ---- rebuild the MEMBRANE from the live bone tips -------------------
    w.root.updateMatrixWorld(true);
    const inv = M.copy(w.root.matrixWorld).invert();
    const pos = w.membrane.geometry.getAttribute('position') as THREE.BufferAttribute;
    // billow: the membrane bags DOWN on the downstroke and snaps taut on the up
    const bag = 0.075 + 0.1 * Math.max(0, -Math.cos(ph - 1.1)) * open;
    const CX = w.cx;
    const CY = w.cy;
    const CZ = w.cz;
    w.tris.forEach((tri, i) => {
      // the three control corners, sagged by their own chord weight (see
      // WingRig.sag): the free trailing edge bags, the taut leading bones do
      // not. Straight down, so it reads the same on both wings.
      tri.forEach((o, k) => {
        if (o === null) V.set(0, 0, 0);
        else V.set(0, 0, 0).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        CX[k] = V.x;
        CY[k] = V.y - bag * w.sag[i * 3 + k];
        CZ[k] = V.z;
      });
      // slots 3-5 are the edge midpoints, pushed down past the straight chord
      // so the panel CURVES (WingRig.bow). Slots 0-2 are the corners, already
      // written above.
      const gx = (CX[0] + CX[1] + CX[2]) / 3;
      const gy = (CY[0] + CY[1] + CY[2]) / 3;
      const gz = (CZ[0] + CZ[1] + CZ[2]) / 3;
      for (let sl = 3; sl < 6; sl += 1) {
        const [a, b] = w.slot[sl];
        const sc = w.scallop[i * 6 + sl];
        CX[sl] = (CX[a] + CX[b]) * 0.5 + (gx - (CX[a] + CX[b]) * 0.5) * sc;
        CY[sl] = (CY[a] + CY[b]) * 0.5 + (gy - (CY[a] + CY[b]) * 0.5) * sc - bag * w.bow[i * 6 + sl];
        CZ[sl] = (CZ[a] + CZ[b]) * 0.5 + (gz - (CZ[a] + CZ[b]) * 0.5) * sc;
      }
      w.sub.forEach((face, f) => {
        for (let k = 0; k < 3; k += 1) {
          const sl = face[k];
          pos.setXYZ((i * w.sub.length + f) * 3 + k, CX[sl], CY[sl], CZ[sl]);
        }
      });
    });
    pos.needsUpdate = true;
    w.membrane.geometry.computeVertexNormals();
    w.membrane.geometry.computeBoundingSphere();
  };

  const update: WyrmDragonBuilt['update'] = (clock, speed, nightK, chained, tuck) => {
    const sp = Math.max(0, Math.min(1, speed));
    const tk = Math.max(0, Math.min(1, tuck ?? 0));
    // ---- the serpentine TRAVELLING WAVE -------------------------------
    const W = 1.9; // rad/s — one full undulation about every 3.3 s
    const A = 0.075 * (0.4 + 0.6 * sp);
    if (chained) {
      // free-standing chain: integrate the wave into real segment poses (no
      // ride runner is placing them). This is what the close-up preview flies.
      let x = 0;
      let y = 0;
      let z = 0;
      let yaw = 0;
      let pitch = 0;
      for (let i = 0; i < N_SEG; i++) {
        const s = segments[i];
        s.position.set(x, y, z);
        s.rotation.set(pitch, yaw, Math.sin(clock * W - i * 0.72 + 1.2) * A * 0.9 * FLEX_W[i]);
        const dy = Math.sin(clock * W - i * 0.72) * A * 2.3 * FLEX_W[i];
        const dp = Math.cos(clock * W * 0.78 - i * 0.62) * A * 0.9 * FLEX_W[i];
        yaw += dy;
        pitch += dp;
        x -= Math.sin(yaw) * SEG_SPACING * Math.cos(pitch);
        z -= Math.cos(yaw) * SEG_SPACING * Math.cos(pitch);
        y += Math.sin(pitch) * SEG_SPACING;
      }
    } else {
      // ridden: the SPLINE has already placed and oriented every segment —
      // lay the wave on top in each segment's own frame (small amplitudes, so
      // the overlapping barrels never open a seam)
      for (let i = 0; i < N_SEG; i++) {
        const s = segments[i];
        const ph = clock * W - i * 0.72;
        const a = A * FLEX_W[i];
        s.rotateY(Math.sin(ph) * a * 1.5);
        s.rotateZ(Math.cos(ph * 0.62 + i * 0.3) * a * 1.1);
        s.rotateX(Math.sin(ph * 0.78 + 0.6) * a * 0.5);
        s.translateX(Math.sin(ph) * a * 0.55);
        s.translateY(Math.sin(ph * 0.85 + 1.1) * a * 0.4);
      }
    }
    // ---- the head: scans, and rears as the beast picks up speed --------
    head.rotation.y = Math.sin(clock * 0.62) * 0.17 * (0.4 + 0.6 * sp);
    head.rotation.x = HEAD_PITCH - 0.16 * sp + Math.sin(clock * 0.48 + 1.4) * 0.07;
    head.rotation.z = Math.sin(clock * 0.53 + 2.1) * 0.09;
    // ---- the JAW: a slow breathing gape, opening wide on the roar ------
    const roar = Math.max(0, Math.sin(clock * 0.42) - 0.55) / 0.45; // ~0 mostly, 1 on the roar
    jaw.rotation.x = (0.17 + 0.32 * roar + 0.05 * Math.sin(clock * 1.3)) * (0.4 + 0.6 * sp);
    // ---- wings + limbs -------------------------------------------------
    // EFFORT: the y component of the head segment's own forward axis — i.e. is
    // the beast climbing? (column 2 of the local matrix; a park yaw cannot
    // change it). The wing beat deepens on the lift and eases on the descent.
    const climb = chained ? 0 : segments[0].matrix.elements[9];
    const effort = Math.max(0.55, Math.min(1.5, 0.85 + climb * 2.4));
    // MAX, not sum: a parked beast standing in the breach is already furled, and
    // adding the two would drive the shoulder past its fold and invert the wing.
    const furl = Math.max(1 - sp, tk);
    wings.forEach((w) => poseWing(w, clock, furl, effort));
    legs.forEach((l, i) => {
      const fore = i < 2;
      const ph = clock * 1.15 + l.phase;
      l.hip.rotation.x = (fore ? 0.5 : -0.4) + Math.sin(ph) * 0.16 * (0.3 + 0.7 * sp);
      l.knee.rotation.x = (fore ? -1.0 : 1.1) - Math.sin(ph - 0.7) * 0.2 * (0.3 + 0.7 * sp);
      l.ankle.rotation.x = (fore ? 0.7 : -0.8) + Math.sin(ph - 1.3) * 0.18 * (0.3 + 0.7 * sp);
    });
    // ---- the glow: eyes and breath, day AND night ----------------------
    const flick = 1 + 0.16 * Math.sin(clock * 2.3) + 0.1 * Math.sin(clock * 5.7 + 1.1);
    // ROUND 9: the daylight floor was 0.35, which is barely above the ambient —
    // the eyes only read after dark, and by day the most characterful part of
    // the beast had nothing lit on it at all. LERP, never gate: 0.95 by day.
    const hot = 0.95 + 1.85 * nightK + roar * 0.9;
    glowMats.forEach((m) => (m.emissiveIntensity = hot * flick));
    headLight.intensity = (0.16 + 0.62 * nightK + roar * 0.3) * flick;
    // ---- the breath rides the nostrils ---------------------------------
    breath.forEach((e, i) => {
      const n = nostrils[i % nostrils.length];
      n.getWorldPosition(V);
      const host = e.points.parent;
      if (host) host.worldToLocal(V);
      e.setOrigin(V.x, V.y, V.z);
      // smoke always, embers on the roar and after dark
      e.setRate(i === 0 ? (4 + 15 * roar) * (0.45 + 0.55 * sp) : (1.5 + 12 * roar) * (0.3 + 0.7 * sp) * (0.65 + 0.65 * nightK));
      e.update(clock);
    });
  };

  return {
    group,
    segments,
    seatAnchors,
    nostrils,
    headLight,
    breathPoints: breath.map((e) => e.points),
    dispose: () => breath.forEach((e) => e.dispose()),
    update,
  };
}

// ===========================================================================
// THE MOSSY RUIN — the shared Thornwick masonry language
// ===========================================================================

/** a hanging ivy strand: a woody stem with leaf clusters down it (one merged
 *  draw call, `lodDetail` — it is close-up dressing) */
export function buildIvyStrand(t: typeof THREE, len: number, seed: number): THREE.Group {
  const g = new t.Group();
  const n = Math.max(3, Math.round(len / 0.26));
  const leaves: MergedBoxSpec[] = [];
  const stem: MergedBoxSpec[] = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const h1 = hash01(seed * 3.1 + i * 1.7);
    const h2 = hash01(seed * 5.3 + i * 2.9);
    const y = -(i + 0.5) * (len / n);
    x += (h1 - 0.5) * 0.06;
    z += (h2 - 0.5) * 0.05;
    stem.push({ dims: [0.016, len / n + 0.02, 0.016], pos: [x, y, z], rotZ: (h1 - 0.5) * 0.2 });
    for (let k = 0; k < 2; k++) {
      const hk = hash01(seed * 7.7 + i * 3.3 + k * 11);
      leaves.push({
        dims: [0.075 + hk * 0.05, 0.014, 0.06 + hk * 0.04],
        pos: [x + (hk - 0.5) * 0.12, y + (k - 0.5) * 0.08, z + (hash01(hk * 9.1) - 0.5) * 0.1],
        rotY: hk * 3.1,
        rotZ: (hk - 0.5) * 0.9,
        rotX: (hash01(hk * 4.4) - 0.5) * 0.7,
      });
    }
  }
  g.add(mergedBoxes(t, stem, THORNWICK.vine, { tex: 'wood', repeat: [1, 2], rough: 0.95 }));
  const lm = mergedBoxes(t, leaves, seed % 2 ? THORNWICK.ivy : THORNWICK.ivyLight, { tex: 'leaf', repeat: [1, 1], rough: 0.8, bump: 0.05 });
  g.add(lm);
  g.userData.lodDetail = true;
  return g;
}

/** a root tendril splitting the masonry: 5 bent tapering segments */
function rootTendril(t: typeof THREE, len: number, seed: number): THREE.Group {
  const g = new t.Group();
  let node: THREE.Object3D = g;
  for (let i = 0; i < 5; i++) {
    const h = hash01(seed * 2.7 + i * 1.9);
    const l = len / 5;
    const seg = new t.Group();
    seg.rotation.set((h - 0.4) * 0.5, (hash01(seed + i * 3.3) - 0.5) * 0.6, 0);
    node.add(seg);
    const r = 0.055 * (1 - i * 0.14);
    const b = cyl(t, r * 0.8, r, l, THORNWICK.root, [0, l / 2, 0], { tex: 'wood', repeat: [1, 2], rough: 0.95, bump: 0.06, seg: 7 });
    seg.add(b);
    const nxt = new t.Group();
    nxt.position.set(0, l, 0);
    seg.add(nxt);
    node = nxt;
  }
  return g;
}

/** GLOW-WORM CRUST — the glade's ground-level living light, as ONE merged mesh
 *  of little emissive grains clustered round the points `at` hands back.
 *
 *  ⚠️ THE DIFFUSE IS A DULL GREY-GREEN, NEVER THE LIT GREEN. MoonlitBarge paid
 *  for this one: a grain whose base colour is the glow colour reads as a speck
 *  of white LITTER right across the ground in daylight. All of the light is in
 *  the emissive, which the caller lerps — damp specks at noon, the ride's only
 *  ground-level light after dark.
 *
 *  Deliberately local rather than imported from ThornwickScenery: this file is
 *  the world's FIRST component and the scenery pack imports its palette FROM
 *  here, so reaching back for `glowWormCrust` would close an import cycle. It is
 *  the same recipe and the same rule. CLUMPED, never evenly scattered — five
 *  grains in a patch read as glow-worms, twenty lonely ones read as confetti. */
function glowGrains(
  t: typeof THREE,
  spots: [number, number, number][],
  opts: { per?: number; spread?: number; size?: number; seed?: number } = {},
): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } | null {
  const per = opts.per ?? 5;
  const spread = opts.spread ?? 0.3;
  const size = opts.size ?? 0.026;
  const seed = opts.seed ?? 1;
  const parts: MergedBoxSpec[] = [];
  spots.forEach((p, i) => {
    for (let k = 0; k < per; k += 1) {
      const h1 = hash01(seed + i * 7.3 + k * 2.9);
      const h2 = hash01(seed + i * 3.1 + k * 5.7 + 11);
      const h3 = hash01(seed + i * 9.7 + k * 1.3 + 23);
      const s = size * (0.6 + h3 * 0.8);
      parts.push({
        dims: [s, s * 0.7, s],
        pos: [p[0] + (h1 - 0.5) * 2 * spread, p[1] + 0.01 + h3 * 0.06, p[2] + (h2 - 0.5) * 2 * spread],
        rotY: h1 * 3.1,
      });
    }
  });
  if (!parts.length) return null;
  const material = mat(t, 0x6a7560, { rough: 0.6 }) as THREE.MeshStandardMaterial;
  material.emissive = new t.Color(0xb6ff8a);
  material.emissiveIntensity = 0.14;
  const mesh = mergedBoxes(t, parts, 0x6a7560, { rough: 0.6 });
  mesh.material = material;
  mesh.userData.lodDetail = true;
  return { mesh, material };
}

/** CARVED RUNES — an archimedean spiral of short chevron strokes sunk into a
 *  stone face, in a material the caller lerps. The world's one COLD light, and
 *  it costs no PointLight; the same motif ThornwickScenery cuts into its tallest
 *  megalith, so the coaster's ruin and the glade's stone circle read as the work
 *  of the same hands. NOT tagged `lodDetail`: the MID tier would shed the whole
 *  night read at exactly park distance. */
function carvedRunes(t: typeof THREE, turns: number, R: number, seed: number): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial } {
  const parts: MergedBoxSpec[] = [];
  const N = 26;
  for (let i = 0; i < N; i += 1) {
    const u = i / (N - 1);
    const a = u * turns * Math.PI * 2;
    const r = R * (0.16 + 0.84 * u);
    const h1 = hash01(seed + i * 4.7);
    parts.push({
      dims: [0.035 + h1 * 0.02, 0.012, 0.075 + h1 * 0.03],
      pos: [Math.sin(a) * r, Math.cos(a) * r, 0],
      rotZ: -a + (h1 - 0.5) * 0.3,
    });
  }
  const material = mat(t, 0x53604a, { rough: 0.7 }) as THREE.MeshStandardMaterial;
  material.emissive = new t.Color(0x7fffbe);
  material.emissiveIntensity = 0.14;
  const mesh = mergedBoxes(t, parts, 0x53604a, { rough: 0.7 });
  mesh.material = material;
  return { mesh, material };
}

// ===========================================================================
// THE RIDE
// ===========================================================================

export interface WyrmsHollowOpts {
  /** RCT2 piece list (compileTrackPieces vocabulary) — replaces the stock
   *  "Wyrm's Coil" circuit. Compiled with this ride's own rules:
   *  `profile: 'coaster'`, `type: 'steel'`, bank 0.70, heading −90°. */
  pieces?: TrackPiece[];
  /** raw control points — the escape hatch past the compiler. `pieces` wins. */
  points?: [number, number, number][];
  /** decorative riders in the saddles (default true; `register` turns them OFF
   *  so the GameManager's real guests ride — capacity 8 = the true seat count) */
  riders?: boolean;
  /** terrain sampler so the ruin, supports and props land on the ground */
  groundAt?: (x: number, z: number) => number;
  /** loop parameter of the BROKEN TOWER (default: auto — the straightest, most
   *  level stretch clear of the station) */
  towerU?: number;
  /** ruined arches over the rails (default 3) */
  arches?: number;
  /** nostril smoke + ember breath (default true) */
  breath?: boolean;
}

export interface WyrmsHollowBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  vehicle?: THREE.Object3D;
  seatWorld: (seat: number) => [number, number, number, number];
  onStateChange: (state: string) => void;
  crashed?: () => boolean;
  invalid?: boolean;
  ratings?: { excitement: number; intensity: number; nausea: number; ratingBand?: string; nauseaExtreme?: boolean };
}

/**
 * The whole attraction: the compiled family circuit, the WYRM that rides it,
 * the broken tower the track threads, the crumbling arches, the mossy station
 * and the glade dressing. `update` is motion-gated (the beast settles and
 * furls its wings in the station while guests board), `seatWorld` seats real
 * guests in the saddles, `vehicle` is the HEAD segment for the follow cam.
 */
export function buildWyrmsHollowScene(three: typeof THREE, opts: WyrmsHollowOpts = {}): WyrmsHollowBuilt {
  const group = new three.Group();
  const extras: { vehicle?: THREE.Object3D; crashed?: () => boolean; invalid?: boolean; ratings?: WyrmsHollowBuilt['ratings'] } = {};
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const lights: THREE.PointLight[] = []; // night-gated (3)
  // LIVING LIGHT — glow-worms, carved runes, a pale toadstool cap. Emissive
  // ONLY, so the ride's night read costs no PointLight at all: the audit's night
  // shot showed the whole 23 × 20 u circuit going essentially black outside the
  // three lantern pools, and the light budget for this world was already spent
  // (19 for the land before gate and path furniture). Lerped, never gated to
  // zero — a glow-worm is alive at noon, it is just outshone.
  const livingMats: THREE.MeshStandardMaterial[] = [];
  const GLOW_DAY = 0.14;
  const GLOW_NIGHT = 1.35;
  let onStateChange: (state: string) => void = () => {};
  let seatWorld: (seat: number) => [number, number, number, number] = () => [0, 0, 0, 0];

  const update =
    ((t: typeof THREE, g: THREE.Group) => {
      const groundAt = opts.groundAt ?? (() => 0);
      const STONE = { tex: 'concrete' as const, repeat: [2, 2] as [number, number], rough: 1, bump: 0.08 };

      // ---- 1. LAYOUT: the shared spline machinery ------------------------
      let pts = opts.points;
      if (!pts) {
        const compiled = compileTrackPieces(opts.pieces ?? DEFAULT_PIECES, {
          profile: 'coaster',
          type: 'steel',
          bank: BANK,
          start: START,
          heading: HEADING,
        });
        pts = compiled.points;
        g.userData.trackReport = compiled.report;
        if (compiled.report.fatal) extras.invalid = true;
      }
      const ride = buildRideSpline(t, pts, {
        profile: 'coaster',
        type: 'steel',
        wood: false,
        bank: BANK,
        groundAt,
        colours: TRACK_COLOURS,
      });
      g.add(ride.group);
      extras.crashed = () => ride.crashed();
      extras.ratings = rateCoaster(pts, { type: 'steel', bank: BANK, cars: 4, sceneryScore: 26 });
      const total = ride.curve.getLength();
      const yawOf = (f: { fwd: THREE.Vector3 }) => Math.atan2(f.fwd.x, f.fwd.z);

      // ---- 2. WHERE THE RUIN GOES ---------------------------------------
      // straightness score per loop parameter, so the tower lands on a long
      // level straight and the arches on the next-best stretches
      const d = 2.2 / total;
      const score = (u: number) => {
        const f = ride.frameAt(u);
        const a = ride.frameAt(u - d).fwd;
        const b = ride.frameAt(u + d).fwd;
        const ah = Math.hypot(a.x, a.z) || 1;
        const bh = Math.hypot(b.x, b.z) || 1;
        const bend = 1 - (a.x * b.x + a.z * b.z) / (ah * bh);
        return (f.p.y - groundAt(f.p.x, f.p.z)) * 0.5 + bend * 40 + Math.abs(f.fwd.y) * 9;
      };
      const cands: { u: number; s: number }[] = [];
      for (let i = 0; i < 200; i++) {
        const u = i / 200;
        if (u < 0.13 || u > 0.86) continue; // never over the station or brake tail
        cands.push({ u, s: score(u) });
      }
      cands.sort((p, q) => p.s - q.s);
      const towerU = opts.towerU ?? (cands[0]?.u ?? 0.5);
      const archUs: number[] = [];
      const wantArches = Math.max(0, Math.min(5, opts.arches ?? 3));
      for (const c of cands) {
        if (archUs.length >= wantArches) break;
        if (Math.abs(c.u - towerU) < 0.1) continue;
        if (archUs.some((u) => Math.abs(u - c.u) < 0.1)) continue;
        archUs.push(c.u);
      }
      g.userData.ruin = { towerU, archUs };

      // ---- 3. THE BROKEN TOWER THE TRACK THREADS ------------------------
      // The tower is parented at its frame and yawed onto the track, so its
      // local +z runs ALONG the rails, +x is the track's side and y is
      // measured from the RAIL CENTRELINE (the ground sits at a negative gy).
      // The track passes through a COLLAPSED BREACH in each side: the masonry
      // ring simply skips every block inside the breach window.
      //
      // DO NOT WIDEN THIS TO CLEAR THE WINGS — that was tried and reverted.
      // The polished beast sweeps a wingtip peak of 2.23 above the rails and a
      // worst half-span of 2.06, against this 1.5 × 1.95 window, so at the
      // extremes of the beat a wing used to pass THROUGH the masonry. Opening
      // the window to 2.3 × 2.5 (and growing R to 3.55 to keep the proportion)
      // does clear it, but the renders are decisive: at that ratio the drum
      // reads as scattered pillars and the arch stops registering, and the
      // coherent breached tower is worth more than the intersection is worth
      // fixing this way. The wings TUCK through the gap instead — see the
      // `tuck` argument threaded into the beast's updater in §8, which is both
      // free and what an actual animal does to get through a hole.
      const lanternMats: THREE.MeshStandardMaterial[] = [];
      {
        const f = ride.frameAt(towerU);
        const tower = new t.Group();
        tower.position.copy(f.p);
        tower.rotation.y = yawOf(f);
        g.add(tower);
        // §8 measures the wing-bearing segment against this to drive the tuck.
        // Stashed as the OBJECT rather than the point so the distance is taken
        // in world space — `run()` re-parents the segments onto the ride, so the
        // beast and the tower are not siblings and their local frames differ.
        g.userData.ruinTower = tower;
        const gy = groundAt(f.p.x, f.p.z) - f.p.y;
        const R = 2.95; // wall centreline radius
        const BREACH_X = 1.5; // half-width of the opening the track runs through
        const CLEAR = 1.95; // clear height above the rails (the tucked wing tip
        //                     stays inside this; skull + horns reach 1.798)
        const COURSE = 0.29;
        const COURSES = 19;
        const SLOTS = 30;
        const blocks: MergedBoxSpec[] = [];
        const dark: MergedBoxSpec[] = [];
        const moss: MergedBoxSpec[] = [];
        for (let c = 0; c < COURSES; c++) {
          const y = gy + 0.1 + c * COURSE;
          const fh = c / (COURSES - 1);
          for (let k = 0; k < SLOTS; k++) {
            const a = ((k + (c % 2) * 0.5) / SLOTS) * Math.PI * 2;
            const bx = Math.sin(a) * R;
            const bz = Math.cos(a) * R;
            // the BREACH: skip anything over the track corridor below CLEAR
            if (Math.abs(bx) < BREACH_X + 0.25 && y < CLEAR) continue;
            // the RUIN: the wall gets more and more broken toward the top, and
            // one flank has collapsed further than the other
            // A per-slot BREAK HEIGHT, not a per-block coin flip: a random
            // skip leaves single blocks floating in mid-air, while a break
            // height gives every vertical strip a jagged but CONTIGUOUS top —
            // which is what a collapsed wall actually looks like. One flank is
            // taken down further than the other.
            // ...and the break height has to vary SMOOTHLY around the ring.
            // A per-slot hash leaves single-slot-wide columns standing, and
            // because the courses are staggered by half a slot those columns
            // zigzag and read as a chimney of floating blocks.
            const h1 = hash01(c * 7.1 + k * 3.7);
            const aSlot = (k / SLOTS) * Math.PI * 2;
            const breakF = 0.44 + 0.2 * Math.sin(aSlot * 2 + 0.9) + 0.14 * Math.sin(aSlot * 3.3 + 2.1) + (bz > 0 ? -0.09 : 0.1);
            if (fh > breakF) continue;
            if (h1 < 0.06) continue; // and the odd block has fallen out lower down
            const h2 = hash01(c * 2.3 + k * 5.9);
            blocks.push({
              dims: [0.62 + h2 * 0.09, COURSE * 0.94, 0.46],
              pos: [bx, y, bz],
              rotY: -a + (h1 - 0.5) * 0.16,
              rotZ: (h2 - 0.5) * 0.05,
              repeat: [2, 1],
            });
            // an inner face course in shadow-stone, so the wall has thickness
            dark.push({ dims: [0.56, COURSE * 0.9, 0.16], pos: [Math.sin(a) * (R - 0.29), y, Math.cos(a) * (R - 0.29)], rotY: -a });
            // MOSS on the top of every block that has sky over it
            if (h2 > 0.5 && (fh > breakF - 0.1 || h1 < 0.45))
              moss.push({ dims: [0.56, 0.035, 0.4], pos: [bx, y + COURSE * 0.48, bz], rotY: -a, repeat: [2, 1] });
          }
        }
        // the breach ARCH: voussoirs stepped over each opening, propped on
        // ragged jambs — the bit of structure that DID hold
        [-1, 1].forEach((s) => {
          for (let k = -4; k <= 4; k++) {
            const fx = k / 4;
            const ax = fx * (BREACH_X + 0.3);
            const ay = CLEAR - 0.03 + (1 - fx * fx) * 0.46;
            if (Math.abs(fx) > 0.7 && hash01(k * 3.3 + s * 9) < 0.3) continue; // the springing blocks have gone
            blocks.push({ dims: [0.44, 0.31, 0.5], pos: [ax, ay, s * Math.sqrt(Math.max(0.04, R * R - ax * ax))], rotZ: fx * 0.34, repeat: [2, 1] });
            if (hash01(k * 5.1 + s * 4) > 0.5) moss.push({ dims: [0.4, 0.035, 0.44], pos: [ax, ay + 0.17, s * Math.sqrt(Math.max(0.04, R * R - ax * ax))], rotZ: fx * 0.34 });
          }
          // jamb stubs either side of the breach
          [-1, 1].forEach((sx) => {
            const jambCourses = Math.max(4, Math.ceil((CLEAR - 0.12 - gy) / COURSE));
            for (let c = 0; c < jambCourses; c++) {
              const h1 = hash01(c * 4.9 + sx * 3 + s * 7);
              blocks.push({
                dims: [0.46, COURSE * 0.95, 0.5],
                pos: [sx * (BREACH_X + 0.28 + (h1 - 0.5) * 0.1), gy + 0.12 + c * COURSE, s * Math.sqrt(Math.max(0.04, R * R - (BREACH_X + 0.28) ** 2))],
                rotY: (h1 - 0.5) * 0.3,
                repeat: [2, 1],
              });
            }
          });
        });
        tower.add(mergedBoxes(t, blocks, THORNWICK.stone, STONE));
        tower.add(mergedBoxes(t, dark, THORNWICK.stoneShade, { tex: 'concrete', repeat: [2, 1], rough: 1, bump: 0.06 }));
        tower.add(mergedBoxes(t, moss, THORNWICK.moss, { tex: 'grass', repeat: [2, 1], rough: 0.95, bump: 0.06 }));

        // fallen masonry heaped round the foot, and the rubble that came out
        // of the breach
        const rubble: MergedBoxSpec[] = [];
        for (let i = 0; i < 26; i++) {
          const h1 = hash01(i * 5.7 + 3);
          const h2 = hash01(i * 3.1 + 11);
          const a = h1 * Math.PI * 2;
          const rr = R + 0.5 + h2 * 1.5;
          const bx = Math.sin(a) * rr;
          const bz = Math.cos(a) * rr * 0.8;
          if (Math.abs(bx) < 1.0 && Math.abs(bz) < 3.4) continue; // keep the corridor clear
          rubble.push({
            dims: [0.38 + h1 * 0.26, 0.26 + h2 * 0.14, 0.34 + h2 * 0.22],
            pos: [bx, gy + 0.14 + h2 * 0.1, bz],
            rotY: h1 * 3.1,
            rotZ: (h2 - 0.5) * 0.3,
            repeat: [2, 1],
          });
        }
        tower.add(mergedBoxes(t, rubble, THORNWICK.stoneDark, STONE));

        // the RUINED SPIRAL STAIR still clinging to the inside of the wall
        const stair: MergedBoxSpec[] = [];
        for (let i = 0; i < 13; i++) {
          const a = 1.1 + i * 0.42;
          const y = gy + 0.5 + i * 0.3;
          if (y > CLEAR + 1.4) break;
          const sx = Math.sin(a) * (R - 0.55);
          const sz = Math.cos(a) * (R - 0.55);
          if (Math.abs(sx) < BREACH_X - 0.1 && y < CLEAR) continue; // the breach took these
          stair.push({ dims: [0.7, 0.13, 0.44], pos: [sx, y, sz], rotY: -a, repeat: [2, 1] });
        }
        tower.add(mergedBoxes(t, stair, THORNWICK.stoneDark, STONE));

        // a broken WINDOW arch high on the surviving flank
        {
          const a = -1.15;
          const wx = Math.sin(a) * R;
          const wz = Math.cos(a) * R;
          const win: MergedBoxSpec[] = [];
          for (let k = -2; k <= 2; k++) {
            const fx = k / 2;
            win.push({ dims: [0.28, 0.24, 0.52], pos: [wx + Math.cos(a) * fx * 0.34, gy + 3.1 + (1 - fx * fx) * 0.3, wz - Math.sin(a) * fx * 0.34], rotY: -a, rotZ: fx * 0.4 });
          }
          tower.add(mergedBoxes(t, win, THORNWICK.stoneDark, STONE));
        }

        // ROOTS splitting the tower base, and IVY down the outside
        for (let i = 0; i < 5; i++) {
          const a = hash01(i * 6.1 + 2) * Math.PI * 2;
          const rt = rootTendril(t, 1.5 + hash01(i * 2.2) * 0.9, 40 + i * 3);
          rt.position.set(Math.sin(a) * (R + 0.1), gy + 0.05, Math.cos(a) * (R + 0.1));
          rt.rotation.set(1.15, a + 0.6, 0);
          rt.userData.lodDetail = true;
          tower.add(rt);
        }
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + 0.3;
          const h1 = hash01(i * 8.3 + 5);
          const iv = buildIvyStrand(t, 0.9 + h1 * 1.5, 60 + i);
          iv.position.set(Math.sin(a) * (R + 0.26), gy + 1.2 + h1 * 2.8, Math.cos(a) * (R + 0.26));
          tower.add(iv);
        }

        // the LANTERN inside the tower — a hanging cage on a bracket, the
        // reason the breach glows as the wyrm comes through it after dark
        {
          const bx = Math.sin(2.0) * (R - 0.5);
          const bz = Math.cos(2.0) * (R - 0.5);
          tower.add(cyl(t, 0.028, 0.028, 0.5, THORNWICK.vine, [bx * 0.86, CLEAR + 0.5, bz * 0.86], { rotZ: 0.9, tex: 'wood', repeat: [1, 2], rough: 0.9, seg: 8 }));
          const glass = ball(t, 0.1, 0xffe3ad, [bx * 0.6, CLEAR + 0.34, bz * 0.6], { emissive: THORNWICK.lantern, rough: 0.35 });
          (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.16;
          tower.add(glass);
          lampMats.push(glass.material as THREE.MeshStandardMaterial);
          lanternMats.push(glass.material as THREE.MeshStandardMaterial);
          tower.add(box(t, [0.14, 0.05, 0.14], WYRM.hornDark, [bx * 0.6, CLEAR + 0.47, bz * 0.6], { tex: 'metal', metal: 0.28, rough: 0.6 }));
          const L = new t.PointLight(THORNWICK.lantern, 0, 6.5, 2);
          L.position.set(bx * 0.6, CLEAR + 0.2, bz * 0.6);
          tower.add(L);
          lights.push(L);
        }

        // LIVING LIGHT ON THE TOWER — no PointLight, and the reason the drum is
        // still THERE after dark instead of being a hole in the night. Runes on
        // the surviving flank (cold green, the glade's stone-circle motif) and
        // glow-worms crusting the rubble heap, the root splits and the wall foot.
        {
          // ⚠️ RUNES GO ON THE OUTER SKIN. The first pass cut them into the wall's
          // INNER face, which is the one place in the tower nothing can see: the
          // drum hides it from every camera outside the circuit and the render
          // came back with no runes in it at all. The surviving masonry is the two
          // quadrants either side of the track (the breaches take the other two),
          // so carve both of THOSE, facing out.
          [Math.PI / 2, -Math.PI / 2].forEach((ra, ri) => {
            const rn = carvedRunes(t, 1.7, 0.5, 71 + ri * 17);
            rn.mesh.position.set(Math.sin(ra) * (R + 0.18), gy + 1.5 + ri * 0.22, Math.cos(ra) * (R + 0.18));
            rn.mesh.rotation.y = ra; // local +z out of the wall
            tower.add(rn.mesh);
            livingMats.push(rn.material);
          });
          const spots: [number, number, number][] = [];
          for (let i = 0; i < 9; i += 1) {
            const a = hash01(i * 5.9 + 31) * Math.PI * 2;
            const rr = R * (0.72 + hash01(i * 2.3 + 7) * 0.55);
            spots.push([Math.sin(a) * rr, gy + 0.06, Math.cos(a) * rr]);
          }
          const gw = glowGrains(t, spots, { per: 6, spread: 0.34, seed: 91 });
          if (gw) {
            tower.add(gw.mesh);
            livingMats.push(gw.material);
          }
        }
      }

      // ---- 4. CRUMBLING ARCHES OVER THE RAILS ---------------------------
      archUs.forEach((u, ai) => {
        const f = ride.frameAt(u);
        const arch = new t.Group();
        arch.position.copy(f.p);
        arch.rotation.y = yawOf(f);
        g.add(arch);
        const gy = groundAt(f.p.x, f.p.z) - f.p.y;
        const HW = 1.7; // pier centreline: the opening clears a beating wing
        const CLEAR = 2.0;
        const specs: MergedBoxSpec[] = [];
        const moss: MergedBoxSpec[] = [];
        const broken = ai === 1; // one of them has lost half its arch
        [-1, 1].forEach((sx) => {
          const courses = Math.max(3, Math.round((CLEAR - gy) / 0.34));
          for (let c = 0; c < courses; c++) {
            const h1 = hash01(c * 3.9 + sx * 7 + ai * 13);
            specs.push({
              dims: [0.44 + h1 * 0.08, 0.28, 0.5 + h1 * 0.06],
              pos: [sx * HW + (h1 - 0.5) * 0.06, gy + 0.14 + c * 0.3, (h1 - 0.5) * 0.1],
              rotY: (h1 - 0.5) * 0.2,
              repeat: [2, 1],
            });
            if (h1 > 0.55) moss.push({ dims: [0.4, 0.03, 0.46], pos: [sx * HW, gy + 0.28 + c * 0.3, 0], rotY: (h1 - 0.5) * 0.2 });
          }
        });
        // the arch ring: nine voussoirs, one or two fallen out
        for (let k = -4; k <= 4; k++) {
          const fx = k / 4;
          if (broken && fx > 0.1) continue; // this one is snapped clean off
          // a hash-skipped voussoir in the MIDDLE of a ring leaves its
          // neighbours hanging in mid-air, so only the springing blocks of an
          // intact ring are ever allowed to be missing
          if (!broken && Math.abs(fx) > 0.7 && hash01(k * 4.7 + ai * 5) < 0.25) continue;
          const ax = fx * (HW + 0.18);
          const ay = CLEAR - 0.02 + (1 - fx * fx) * 0.52;
          specs.push({ dims: [0.42, 0.3, 0.58], pos: [ax, ay, 0], rotZ: fx * 0.42, repeat: [2, 1] });
          if (hash01(k * 6.1 + ai) > 0.42) moss.push({ dims: [0.38, 0.035, 0.54], pos: [ax, ay + 0.16, 0], rotZ: fx * 0.42 });
        }
        if (!broken) specs.push({ dims: [0.6, 0.24, 0.68], pos: [0, CLEAR + 0.66, 0], repeat: [2, 1] }); // keystone cap
        arch.add(mergedBoxes(t, specs, THORNWICK.stone, STONE));
        arch.add(mergedBoxes(t, moss, THORNWICK.mossDeep, { tex: 'grass', repeat: [2, 1], rough: 0.95, bump: 0.06 }));
        // fallen blocks at the foot, clear of the corridor
        const fallen: MergedBoxSpec[] = [];
        for (let i = 0; i < 7; i++) {
          const h1 = hash01(i * 5.3 + ai * 9);
          const h2 = hash01(i * 2.7 + ai * 4);
          fallen.push({
            dims: [0.34 + h1 * 0.2, 0.26, 0.36 + h2 * 0.18],
            pos: [(i % 2 ? 1 : -1) * (HW + 0.45 + h1 * 0.9), gy + 0.15, (h2 - 0.5) * 2.6],
            rotY: h1 * 3.1,
            rotZ: (h2 - 0.5) * 0.24,
            repeat: [2, 1],
          });
        }
        arch.add(mergedBoxes(t, fallen, THORNWICK.stoneDark, STONE));
        // ivy over the arch and a root at the pier foot
        [-1, 1].forEach((sx) => {
          const iv = buildIvyStrand(t, 1.0 + hash01(ai * 3.1 + sx) * 0.8, 90 + ai * 5 + (sx > 0 ? 1 : 2));
          iv.position.set(sx * (HW - 0.1), CLEAR + 0.32, 0.28);
          arch.add(iv);
          const rt = rootTendril(t, 1.1, 70 + ai * 3 + (sx > 0 ? 0 : 1));
          rt.position.set(sx * (HW + 0.3), gy + 0.05, -0.5);
          rt.rotation.set(1.25, sx * 1.4, 0);
          rt.userData.lodDetail = true;
          arch.add(rt);
        });
        // a brazier on the FIRST arch — the one night-gated flame trackside
        if (ai === 0) {
          const bx = HW + 0.42;
          arch.add(cyl(t, 0.05, 0.07, 0.9, THORNWICK.stoneDark, [bx, gy + 0.45, 1.0], { ...STONE, seg: 10 }));
          const bowl = cyl(t, 0.2, 0.12, 0.16, THORNWICK.stoneDark, [bx, gy + 0.98, 1.0], { ...STONE, seg: 12 });
          arch.add(bowl);
          const coals = ball(t, 0.15, 0xffc070, [bx, gy + 1.04, 1.0], { emissive: 0xff9838, rough: 0.4 });
          (coals.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
          coals.scale.y = 0.5;
          arch.add(coals);
          lampMats.push(coals.material as THREE.MeshStandardMaterial);
          const L = new t.PointLight(0xffa64c, 0, 5.5, 2);
          L.position.set(bx, gy + 1.2, 1.0);
          arch.add(L);
          lights.push(L);
        }
        // GLOW-WORMS at both pier feet and through the fallen blocks, so every
        // arch marks itself after dark — the two unlit ones used to vanish
        {
          const spots: [number, number, number][] = [];
          [-1, 1].forEach((sx) => {
            spots.push([sx * (HW + 0.16), gy + 0.05, -0.34]);
            spots.push([sx * (HW + 0.5 + hash01(ai * 3.7 + sx) * 0.7), gy + 0.05, (hash01(ai * 2.1 + sx) - 0.5) * 2.2]);
          });
          const gw = glowGrains(t, spots, { per: 5, spread: 0.3, seed: 140 + ai * 13 });
          if (gw) {
            arch.add(gw.mesh);
            livingMats.push(gw.material);
          }
        }
      });

      // ---- 5. THE STATION: a mossy stone platform in the ruin -----------
      {
        const st = ride.frameAt(0);
        const yard = new t.Group();
        yard.position.set(st.p.x, 0, st.p.z);
        yard.rotation.y = yawOf(st);
        g.add(yard);
        const deckTop = st.p.y + 0.02;
        const DX = 1.0; // inner edge 0.5 clears the tie ends
        yard.add(box(t, [1.0, 0.12, 3.0], THORNWICK.stone, [DX, deckTop - 0.06, 1.3], { tex: 'concrete', repeat: [3, 8], rough: 1, bump: 0.08 }));
        yard.add(box(t, [0.94, 0.03, 2.92], THORNWICK.mossDeep, [DX, deckTop + 0.015, 1.3], { tex: 'grass', repeat: [3, 8], rough: 0.95, bump: 0.05 }));
        const stoneSpecs: MergedBoxSpec[] = [];
        // the platform's dry-stone underpinning
        [0.2, 1.3, 2.4].forEach((z) =>
          [0.62, 1.4].forEach((x) => {
            stoneSpecs.push({ dims: [0.3, deckTop - 0.14, 0.3], pos: [x, (deckTop - 0.14) / 2, z], repeat: [1, 2] });
          }),
        );
        [0, 1, 2].forEach((k) => stoneSpecs.push({ dims: [0.7, 0.1, 0.3], pos: [1.1, 0.16 + k * 0.13, -0.55 + k * 0.13], repeat: [2, 1] })); // steps
        // a low ruined wall down the outside of the platform
        for (let i = 0; i < 9; i++) {
          const h1 = hash01(i * 4.3 + 21);
          const cs = 2 + Math.round(hash01(i * 7.7) * 2);
          for (let c = 0; c < cs; c++)
            stoneSpecs.push({
              dims: [0.42, 0.3, 0.5],
              pos: [1.72, deckTop + 0.15 + c * 0.3, -0.1 + i * 0.36],
              rotY: (h1 - 0.5) * 0.2,
              repeat: [2, 1],
            });
        }
        yard.add(mergedBoxes(t, stoneSpecs, THORNWICK.stone, STONE));
        // timber canopy on four posts, mossy shingles over it
        const beam: MergedBoxSpec[] = [];
        [0.62, 1.38].forEach((x) => [0.35, 2.25].forEach((z) => beam.push({ dims: [0.12, 1.3, 0.12], pos: [x, deckTop + 0.65, z], repeat: [1, 3] })));
        [0.62, 1.38].forEach((x) => beam.push({ dims: [0.1, 0.12, 3.1], pos: [x, deckTop + 1.34, 1.3], repeat: [1, 8] }));
        [0.35, 1.3, 2.25].forEach((z) => beam.push({ dims: [1.0, 0.1, 0.1], pos: [DX, deckTop + 1.34, z], repeat: [2, 1] }));
        yard.add(mergedBoxes(t, beam, 0x53422f, { tex: 'wood', repeat: [1, 3], rough: 0.92, bump: 0.05 }));
        const roof: MergedBoxSpec[] = [];
        [-1, 1].forEach((s) => roof.push({ dims: [0.8, 0.08, 3.3], pos: [DX + s * 0.3, deckTop + 1.5, 1.3], rotZ: s * 0.44, repeat: [3, 9] }));
        roof.push({ dims: [0.16, 0.1, 3.34], pos: [DX, deckTop + 1.62, 1.3], repeat: [1, 9] });
        yard.add(mergedBoxes(t, roof, 0x46402f, { tex: 'wood', repeat: [2, 6], rough: 0.95, bump: 0.05 }));
        const roofMoss: MergedBoxSpec[] = [];
        for (let i = 0; i < 12; i++) {
          const h1 = hash01(i * 3.7 + 31);
          const s = i % 2 ? 1 : -1;
          roofMoss.push({ dims: [0.34 + h1 * 0.2, 0.035, 0.4], pos: [DX + s * (0.16 + h1 * 0.4), deckTop + 1.53 + (0.3 - h1 * 0.3) * 0.2, -0.1 + (i / 12) * 2.9], rotZ: s * 0.44 });
        }
        yard.add(mergedBoxes(t, roofMoss, THORNWICK.moss, { tex: 'grass', repeat: [1, 1], rough: 0.95, bump: 0.06 }));
        // ivy down the canopy posts
        [0.35, 2.25].forEach((z, i) => {
          const iv = buildIvyStrand(t, 1.0, 120 + i);
          iv.position.set(1.44, deckTop + 1.28, z);
          yard.add(iv);
        });
        // the station LANTERN, hung off the canopy over the boarding edge
        const lampY = deckTop + 1.2;
        yard.add(cyl(t, 0.02, 0.02, 0.16, THORNWICK.vine, [DX + 0.3, lampY + 0.08, 1.3], { rough: 0.9, seg: 6 }));
        const glass = ball(t, 0.1, 0xffe3ad, [DX + 0.3, lampY - 0.06, 1.3], { emissive: THORNWICK.lantern, rough: 0.35 });
        (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.16;
        yard.add(glass);
        lampMats.push(glass.material as THREE.MeshStandardMaterial);
        const sl = new t.PointLight(THORNWICK.lantern, 0, 5.5, 2);
        sl.position.set(DX + 0.3, lampY - 0.2, 1.3);
        yard.add(sl);
        lights.push(sl);
        // a weathered WYRM-HEAD boss over the boarding gate: the ride's sign
        {
          const boss = new t.Group();
          boss.position.set(1.62, deckTop + 1.05, 1.3);
          boss.rotation.y = Math.PI / 2;
          yard.add(boss);
          boss.add(box(t, [0.34, 0.34, 0.14], THORNWICK.stone, [0, 0, 0], STONE));
          boss.add(cyl(t, 0.07, 0.12, 0.24, THORNWICK.stoneDark, [0, -0.02, 0.16], { rotX: Math.PI / 2, ...STONE, seg: 8 }));
          [-1, 1].forEach((sx) => {
            boss.add(cyl(t, 0.005, 0.028, 0.2, THORNWICK.stoneDark, [sx * 0.1, 0.16, 0.02], { rotZ: sx * 0.5, rotX: -0.3, rough: 1, seg: 6 }));
            const e = ball(t, 0.028, 0xffcf62, [sx * 0.06, 0.04, 0.2], { emissive: 0xffb45e, rough: 0.35 });
            (e.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
            boss.add(e);
            lampMats.push(e.material as THREE.MeshStandardMaterial);
          });
          boss.add(mergedBoxes(t, [{ dims: [0.3, 0.04, 0.3], pos: [0, 0.19, 0.02] }], THORNWICK.moss, { tex: 'grass', repeat: [1, 1], rough: 0.95 }));
        }
        // glow-worms along the platform's mossy edge and under the ruined wall:
        // the queue and the boarding edge get a little living light of their own,
        // which is where the guests actually stand after dark
        {
          const spots: [number, number, number][] = [];
          for (let i = 0; i < 6; i += 1) {
            const z = 0.05 + (i / 5) * 2.5;
            spots.push([DX - 0.42, deckTop + 0.03, z]); // the mossy boarding edge
            if (i % 2 === 0) spots.push([DX + 0.44, deckTop + 0.03, z]); // outer edge
          }
          const gw = glowGrains(t, spots, { per: 4, spread: 0.16, size: 0.022, seed: 260 });
          if (gw) {
            yard.add(gw.mesh);
            livingMats.push(gw.material);
          }
        }
      }

      // ---- 6. THE GLADE: mossy boulders, fallen columns, ferns ----------
      {
        for (let i = 0; i < 20; i++) {
          const u = (i + 0.5) / 20;
          if (Math.abs(u - towerU) < 0.08) continue;
          const f = ride.frameAt(u);
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          const lx = f.side.x / ln;
          const lz = f.side.z / ln;
          const h1 = hash01(i * 5.9 + 17);
          const h2 = hash01(i * 3.3 + 41);
          const sgn = i % 2 ? 1 : -1;
          const off = 2.1 + h1 * 1.8;
          const rx = f.p.x + lx * sgn * off;
          const rz = f.p.z + lz * sgn * off;
          const gyw = groundAt(rx, rz);
          if (h2 < 0.42) {
            // a MOSS-GROWN boulder. The moss is a TINT, not a cap slab: a flat
            // quad floated over `buildRock`'s squashed icosahedron (which tops
            // out well under `scale`) and read as a paving slab in mid-air.
            const sc = 0.4 + h1 * 0.6;
            const rock = buildRock(t, { scale: sc, seed: 210 + i * 7, tint: h1 > 0.62 ? THORNWICK.mossDeep : h1 > 0.3 ? THORNWICK.stoneShade : THORNWICK.stoneDark });
            rock.position.set(rx, gyw, rz);
            if (sc < 0.6) rock.userData.lodDetail = true;
            g.add(rock);
          } else if (h2 < 0.6) {
            // a fallen column, half sunk in the moss
            const col = new t.Group();
            col.position.set(rx, gyw, rz);
            col.rotation.y = h1 * 3.1;
            g.add(col);
            const n = 2 + Math.round(h1 * 2);
            for (let k = 0; k < n; k++)
              col.add(
                cyl(t, 0.19, 0.2, 0.62, THORNWICK.stone, [0, 0.19, -0.9 + k * 0.68 + (hash01(k * 3.1 + i) - 0.5) * 0.12], {
                  rotZ: Math.PI / 2,
                  rotY: (hash01(k * 5.3 + i) - 0.5) * 0.24,
                  ...STONE,
                  seg: 10,
                }),
              );
            col.add(
              mergedBoxes(t, [{ dims: [0.44, 0.035, 1.9], pos: [0, 0.37, -0.1] }], THORNWICK.moss, { tex: 'grass', repeat: [1, 3], rough: 0.95 }),
            );
          } else if (h2 < 0.78) {
            const log = buildScenery(t, 'fallenLog', { scale: 0.75, seed: 300 + i });
            log.position.set(rx, gyw, rz);
            log.rotation.y = h1 * 3.1;
            log.userData.lodDetail = true;
            g.add(log);
          } else {
            const sh = buildScenery(t, 'mushroomCluster', { scale: 0.9, seed: 400 + i });
            sh.position.set(rx, gyw, rz);
            sh.rotation.y = h1 * 3.1;
            sh.userData.lodDetail = true;
            g.add(sh);
          }
        }
        // a scatter of mossy kerb stones marking the old road under the ride
        const kerb: MergedBoxSpec[] = [];
        for (let i = 0; i < 22; i++) {
          const u = (i + 0.5) / 22;
          const f = ride.frameAt(u);
          const ln = Math.hypot(f.side.x, f.side.z) || 1;
          const h1 = hash01(i * 6.7 + 9);
          const sgn = i % 2 ? 1 : -1;
          const off = 1.55 + h1 * 0.3;
          const kx = f.p.x + (f.side.x / ln) * sgn * off;
          const kz = f.p.z + (f.side.z / ln) * sgn * off;
          kerb.push({ dims: [0.3 + h1 * 0.16, 0.16, 0.34], pos: [kx, groundAt(kx, kz) + 0.07, kz], rotY: h1 * 3.1 });
        }
        const kerbMesh = mergedBoxes(t, kerb, THORNWICK.stoneDark, STONE);
        kerbMesh.userData.lodDetail = true;
        g.add(kerbMesh);

        // ---- THE GLADE'S OWN LIVING LIGHT ------------------------------
        // The audit's night shot had the whole circuit outside the three lantern
        // pools reading as a black hole in the land, which is the rubric's
        // "presence, not brightness" failure and a genuine one: this is a NIGHT
        // world whose light budget is spent. Emissives cost nothing, so the old
        // road gets glow-worms along it and two of the mushroom clumps get a
        // pale glowing cap — the same two devices ThornwickScenery uses, so the
        // coaster's half of the land lights up in the world's own language
        // rather than growing lamps it cannot afford.
        {
          const spots: [number, number, number][] = [];
          for (let i = 0; i < 16; i += 1) {
            const u = (i + 0.28) / 16;
            const f = ride.frameAt(u);
            const ln = Math.hypot(f.side.x, f.side.z) || 1;
            const h1 = hash01(i * 4.3 + 51);
            const sgn = i % 3 === 0 ? 1 : -1;
            const off = 1.5 + h1 * 1.5;
            const gx = f.p.x + (f.side.x / ln) * sgn * off;
            const gz = f.p.z + (f.side.z / ln) * sgn * off;
            spots.push([gx, groundAt(gx, gz) + 0.02, gz]);
          }
          const gw = glowGrains(t, spots, { per: 6, spread: 0.42, seed: 210 });
          if (gw) {
            g.add(gw.mesh);
            livingMats.push(gw.material);
          }
          // TWO PALE GLOWING CAPS on the moss, on the far side of the circuit
          // from the station so the dark half of the land gets the light. Half
          // strength: a cap is a broad flat surface and at full glow it renders
          // as a solid white-green disc with no form in it (ThornwickScenery's
          // number, and its reason).
          [0.42, 0.66].forEach((u, i) => {
            const f = ride.frameAt(u);
            const ln = Math.hypot(f.side.x, f.side.z) || 1;
            const off = 2.5 + i * 0.8;
            const cx = f.p.x - (f.side.x / ln) * off;
            const cz = f.p.z - (f.side.z / ln) * off;
            const cy = groundAt(cx, cz);
            const clump = new t.Group();
            clump.position.set(cx, cy, cz);
            clump.rotation.y = hash01(i * 7.7) * 3.1;
            g.add(clump);
            const capMat = mat(t, 0xb9c4a2, { rough: 0.72 }) as THREE.MeshStandardMaterial;
            capMat.emissive = new t.Color(0xcaffd2);
            capMat.emissiveIntensity = 0.07;
            for (let k = 0; k < 3; k += 1) {
              const h1 = hash01(i * 3.3 + k * 5.1);
              const rr = 0.16 + h1 * 0.12;
              const sx2 = (h1 - 0.5) * 0.5;
              const sz2 = (hash01(i * 9.1 + k) - 0.5) * 0.5;
              clump.add(cyl(t, rr * 0.28, rr * 0.4, 0.24 + h1 * 0.16, 0xd8d2b8, [sx2, 0.12 + h1 * 0.08, sz2], { tex: 'fabric', rough: 0.9, seg: 8 }));
              const cap = new t.Mesh(new t.SphereGeometry(rr, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.56), capMat);
              cap.position.set(sx2, 0.24 + h1 * 0.16, sz2);
              cap.scale.y = 0.62;
              clump.add(cap);
            }
            livingMats.push(capMat);
            clump.userData.lodDetail = true;
          });
          // GLOWING FLOWER PODS on nodding stalks, seven spots round the circuit —
          // the third of ThornwickScenery's three lights, and the one that puts
          // colour at eye level rather than on the ground. A bed of them is the
          // glade's filler piece; here it is the coaster's night legibility, for
          // three merged draws and no lamp.
          {
            const stalks: MergedBoxSpec[] = [];
            const coreMat = mat(t, 0x8f7fa8, { rough: 0.5 }) as THREE.MeshStandardMaterial;
            coreMat.emissive = new t.Color(0xd9b6ff);
            coreMat.emissiveIntensity = 0.14;
            const petalMat = mat(t, 0x7c6a92, { rough: 0.8 }) as THREE.MeshStandardMaterial;
            const pods = new t.Group();
            g.add(pods);
            for (let i = 0; i < 7; i += 1) {
              const u = (i + 0.15) / 7;
              if (Math.abs(u - towerU) < 0.06) continue;
              const f = ride.frameAt(u);
              const ln = Math.hypot(f.side.x, f.side.z) || 1;
              const h1 = hash01(i * 6.1 + 71);
              const sgn = i % 2 ? 1 : -1;
              const off = 1.9 + h1 * 1.9;
              const px = f.p.x + (f.side.x / ln) * sgn * off;
              const pz = f.p.z + (f.side.z / ln) * sgn * off;
              const py = groundAt(px, pz);
              for (let k = 0; k < 3; k += 1) {
                const h2 = hash01(i * 3.7 + k * 9.1);
                const dx = (h2 - 0.5) * 0.42;
                const dz = (hash01(i * 5.3 + k * 2.7) - 0.5) * 0.42;
                const hgt = 0.2 + h2 * 0.14;
                // the stalk NODS: upright out of the ground, bent over at the top,
                // which is what makes a pod read as heavy and alive
                stalks.push({ dims: [0.016, hgt, 0.016], pos: [px + dx, py + hgt / 2, pz + dz], rotZ: (h2 - 0.5) * 0.5 });
                const core = ball(t, 0.03 + h2 * 0.014, 0x8f7fa8, [px + dx + (h2 - 0.5) * 0.09, py + hgt + 0.03, pz + dz], { rough: 0.5 });
                core.material = coreMat;
                pods.add(core);
                if (k === 0) {
                  const petal = ball(t, 0.055, 0x7c6a92, [px + dx + (h2 - 0.5) * 0.09, py + hgt + 0.012, pz + dz], { rough: 0.8 });
                  petal.material = petalMat;
                  petal.scale.set(1, 0.34, 1);
                  pods.add(petal);
                }
              }
            }
            if (stalks.length) pods.add(mergedBoxes(t, stalks, GLADE_STALK, { tex: 'leaf', repeat: [1, 2], rough: 0.9 }));
            pods.userData.lodDetail = true;
            livingMats.push(coreMat);
          }
        }
      }

      // ---- 7. THE WYRM --------------------------------------------------
      const wyrm = buildWyrmDragon(t, { riders: opts.riders ?? true, breath: opts.breath });
      // the breath lives in the RIDE's space, so the smoke is left behind
      wyrm.breathPoints.forEach((pt) => g.add(pt));
      extras.vehicle = wyrm.segments[0]; // the HEAD leads: the follow cam rides it
      seatWorld = makeSeatWorld(t, wyrm.seatAnchors);
      const run = ride.run(wyrm.segments, { spacing: SEG_SPACING, wheelOffset: 0.2 });

      // ---- 8. the gated updater -----------------------------------------
      // THE WING TUCK. The breach is 1.5 half-width × 1.95 clear and the beating
      // wing sweeps 2.06 × 2.23, so something has to give. Widening the opening
      // was tried and destroys the tower's read (see §3), and shortening the
      // wing undoes the whole point of the polish pass — so the beast folds its
      // wings to get through the hole, which is what a real animal does. The
      // fold is driven by the WING-BEARING segment (3, where the roots are
      // mounted), not the head: the head clears the masonry a full body-length
      // before the shoulders reach it.
      const tuckTower = g.userData.ruinTower as THREE.Object3D | undefined;
      const wingSeg = wyrm.segments[3];
      const pSeg = new three.Vector3();
      const pTow = new three.Vector3();
      // THE WALL IS AT RADIUS R (2.95), NOT AT THE TOWER CENTRE — the fold has
      // to be COMPLETE by the time the shoulders reach the masonry, not by the
      // time they reach the middle of the tower. A first pass ramped to full
      // tuck at 1.9 and the wing was still 78% open where it actually hits
      // stone. Measured (`/tmp/mp3d-render/wyrmtuck-*`): the open wing sweeps
      // 2.31 high × 2.11 half-span against a 1.95 × 1.50 window; tuck 0.5 gets
      // it to 1.83 × 0.89 and tuck 1 to 1.83 × 0.67. Full fold from 3.05 out
      // therefore clears the wall crossing with room, and holds all the way
      // through the drum since the distance only shrinks from there.
      const TUCK_FAR = 4.7; // starts pulling in, ~1.75 clear of the stonework
      const TUCK_NEAR = 3.05; // fully folded — just OUTSIDE the wall at R 2.95

      // ---- 8b. THE STATION LOCK -----------------------------------------
      // ⚠️ `rideDuration` IS NOT THE LAP, AND SETTING IT TO THE LAP IS A BUG.
      // createMotionGate keeps integrating its clock through the spin-UP of
      // `departing` (whose length is `loadTime`, which configurableRide
      // defaults to 1.6 — not the FSM's bare 1.0) and through the eased brake
      // of `arriving`, so the clock advance per FSM dispatch is
      //     loadTime-integral (1.2) + rideDuration + arriving-integral (0.75)
      // = rideDuration + 1.95, not rideDuration. Registered at 14 against a
      // 13.53 s lap the beast therefore overshot one lap EVERY dispatch and
      // parked somewhere new each time: measured over 8 cycles, the nearest
      // saddle sat 1.2 / 11.2 / 16.4 / 21.5 / 17.3 / 4.4 / 5.5 / 13.7 u from
      // the boarding pad — i.e. anywhere on the circuit, with guests seated
      // into saddles on the far side of the ruin. (Tidewater's audit found the
      // same class of bug: a ride registered at 22 s with a 57 s lap.)
      //
      // Cancelling the surplus in `rideDuration` alone is NOT a fix: the gate's
      // ramp integrals carry O(dt) error and SplineRideKit's runner clamps its
      // own dt to 0.06, so the value that locks at dt = 1/30 still creeps 4.0 u
      // over 12 cycles at dt = 1/20. So the beast BRAKES INTO ITS STATION AND
      // HOLDS: rail time stops advancing at the frame after the head passes
      // closest approach to the parked pose, and only resumes on dispatch.
      // dt-independent by construction, to within one frame of arc.
      //
      // The parked pose is DERIVED, not guessed: find the arc nearest the
      // boarding pad the composable publishes, then lead it by the saddle
      // band's mean offset so the four RIDDEN segments straddle the pad.
      // Measured at that pose: nearest saddle 0.38 u / mean 0.99, against
      // 3.03 / 3.84 at the raw build pose (the head alone on the pad).
      const boardLocal = new three.Vector3(...BOARD);
      let sBoard = 0;
      let sBoardD = Infinity;
      for (let i = 0; i < 720; i += 1) {
        const s = (i / 720) * total;
        const d = ride.frameAt(s / total).p.distanceTo(boardLocal);
        if (d < sBoardD) {
          sBoardD = d;
          sBoard = s;
        }
      }
      const stopU = (((sBoard + SADDLE_MID_OFFSET) / total) % 1 + 1) % 1;
      const stopP = ride.frameAt(stopU).p.clone();
      g.userData.stationStop = { u: stopU, at: [stopP.x, stopP.y, stopP.z] };
      let railT = 0;
      let lastClock: number | null = null;
      let gated = false; // only a REGISTERED ride parks — a preview runs free
      let holding = false;
      let armed = false;
      let prevD = Infinity;
      let sinceDispatch = 0;
      let fedT = 0; // rail time already handed to the runner
      const pStop = new three.Vector3();

      const gate = createMotionGate(
        (clock, speed) => {
          const dc = lastClock === null ? 0 : Math.max(0, clock - lastClock);
          lastClock = clock;
          if (!holding) {
            railT += dc;
            sinceDispatch += dc;
          }
          // ⚠️ SUBSTEP THE RUNNER. `makeGuardedRun` integrates uHead with its OWN
          // `dt = min(0.06, time − last)`, so at any frame time over 60 ms the
          // train silently advances SLOWER than the clock it is handed — under
          // swiftshader (dt clamped to 0.1) it covers 60 % of a lap per dispatch,
          // never reaches its station, and the lock below therefore never armed:
          // measured, the parked pose alternated 0.46 / 19.84 u from the pad
          // every other cycle. Feeding rail time in ≤ 50 ms slices is the same
          // integration at any frame rate. Also note run() MUST be called at
          // least once a frame even while holding: `wyrm.update`'s serpentine
          // wave is applied with cumulative rotateY/Z/X on top of the pose run()
          // writes, so a frame without it would let the wave accumulate and the
          // body would corkscrew apart.
          const steps = Math.max(1, Math.ceil((railT - fedT) / 0.05));
          for (let i = 1; i <= steps; i += 1) run(fedT + ((railT - fedT) * i) / steps);
          fedT = railT;
          const nk = nightKOf(g);
          const ease = nk * nk * (3 - 2 * nk);
          let tuck = 0;
          if (tuckTower) {
            const d = wingSeg.getWorldPosition(pSeg).distanceTo(tuckTower.getWorldPosition(pTow));
            const k = Math.max(0, Math.min(1, (TUCK_FAR - d) / (TUCK_FAR - TUCK_NEAR)));
            tuck = k * k * (3 - 2 * k); // smoothstep: no snap at either end
          }
          g.userData.wingTuck = tuck; // diagnostic: probes assert this reaches 1
          // the CREATURE runs on the gate clock, not on rail time: while the
          // station lock is holding the beast in place its wings must still
          // beat and its jaw still breathe — a held pose that freezes the whole
          // animal reads as a dropped frame, not as a train that has arrived.
          wyrm.update(clock, speed, nk, undefined, tuck); // wave, wings, jaw, glow
          lampMats.forEach((m, i) => (m.emissiveIntensity = 0.16 + (i < 2 ? 1.5 : 1.0) * ease));
          // LIVING LIGHT: lerped on the raw nightK, never gated to zero, and each
          // material breathing on its own phase so the glade is not one bulb.
          // The pale toadstool caps take HALF, because a broad flat emissive
          // surface at full strength renders as a solid white-green disc.
          livingMats.forEach((m, i) => {
            const half = m.emissive.getHex() === 0xcaffd2 ? 0.5 : 1;
            m.emissiveIntensity =
              (GLOW_DAY + (GLOW_NIGHT - GLOW_DAY) * nk) * half * (0.84 + 0.16 * Math.sin(clock * 0.7 + i * 1.3) + 0.08 * Math.sin(clock * 1.9 + i));
          });
          lights.forEach((l, i) => (l.intensity = (i === 0 ? 1.05 : 0.8) * ease * (1 + 0.05 * Math.sin(clock * 3.1 + i))));
          // the brake: hold the frame AFTER closest approach, so the stop lands
          // within one frame of arc of the pose rather than on first contact
          // with a threshold ball (which would stop it a whole radius early)
          if (gated && !holding && sinceDispatch > 4) {
            const d = g.worldToLocal(wyrm.segments[0].getWorldPosition(pStop)).distanceTo(stopP);
            if (armed && d > prevD) holding = true;
            if (d < 2.2) armed = true;
            prevD = d;
          }
          g.userData.stationHold = holding;
        },
        { spinDown: 2.0 },
      );
      onStateChange = (state: string) => {
        gated = true;
        if (state === 'departing' || state === 'travelling') {
          holding = false;
          armed = false;
          prevD = Infinity;
          sinceDispatch = 0;
        }
        gate.onStateChange(state);
      };
      return gate.update;
    })(three, group) || undefined;

  return { group, update, seatWorld, onStateChange, ...extras };
}

const WyrmsHollowBase = composableRide<WyrmsHollowOpts & { register?: boolean }>(
  'WyrmsHollow',
  (t, props) =>
    buildWyrmsHollowScene(t, {
      pieces: props.pieces,
      points: props.points,
      groundAt: props.groundAt,
      towerU: props.towerU,
      arches: props.arches,
      breath: props.breath,
      // decorative riders standalone; OFF when registered so the GameManager's
      // real guests fill the eight saddles
      riders: props.riders ?? !props.register,
    }),
  {
    // the station straight runs along local −x and every compiled point has
    // z ≤ 0, so the local +z face is free
    front: 2.0,
    exit: [1.7, 1.9],
    board: BOARD,
    // rideDuration 12.2, NOT the 13.6 s lap: the gate adds 1.95 s of ramp
    // integral to every dispatch, so 12.2 + 1.95 = 14.15 lands the beast just
    // PAST its parked pose and §8b's station lock brakes it onto it. See §8b —
    // registering the lap itself parked the beast up to 21.5 u off the pad.
    defaults: { name: "Wyrm's Hollow", capacity: 8, rideDuration: 12.2, intensity: 4, price: 5 },
  },
);

/** <WyrmsHollow> — the Thornwick Glade's DRAGON FAMILY COASTER as a composable
 *  ride (components/Park/Context.md): mounts at `position`/`rotation`; inside a
 *  <Park>, `register` wires the full GameManager ride via <ConfigurableRide> —
 *  queue HEAD 2.0 out the local +z front (the face the circuit keeps clear),
 *  exit hut at local [1.7, 1.9], boarding on the mossy platform. Capacity 8 =
 *  the true saddle count (4 ridden segments × 2), `rideDuration` 14 s against a
 *  measured 13.6 s lap.
 *
 *  SAME SPLINE LOGIC as every other tracked ride: a `pieces` array or piece
 *  children (`<Station/><Lift/><Drop/><Hill/><TurnR/>…` — children win) are
 *  compiled by `compileTrackPieces` with this ride's rule set
 *  (`profile: 'coaster'`, `type: 'steel'`, bank 0.70) and swept by
 *  `buildRideSpline`; `points` is the raw-control-point escape hatch. No pieces
 *  = the stock "Wyrm's Coil" family circuit. A FATAL compile marks the build
 *  `invalid` (no registration).
 *
 *  THE WYRM IS THE TRAIN: eleven segments placed by the spline runner, so the
 *  beast bends through the layout as it rides it. The HEAD segment is the ride
 *  `vehicle` (RideViewer follow cam). */
export const WyrmsHollow: React.FC<ComposableRideProps & WyrmsHollowOpts & { children?: React.ReactNode }> = ({ children, pieces, ...rest }) => {
  const resolved = collectTrackPieces(children) ?? pieces;
  return <WyrmsHollowBase {...rest} {...(resolved ? { pieces: resolved } : {})} />;
};

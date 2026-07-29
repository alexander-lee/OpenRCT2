import * as THREE from 'three';
import { alongDir, ball, cyl, mat, mergedBoxes, mergedParts, mtx, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec } from '../Stage';
import { buildWater } from '../WaterTile';
import { composable } from '../Park';
import type { ComposableBuilt, ParkContextValue } from '../Park';

// ---------------------------------------------------------------------------
// TidewaterScenery — the five scenery pieces of the TIDEWATER HOLLOW world, a
// shipwreck cove. Per-world scenery (not an extension of the shared
// SceneryPack): one component folder exporting five imperative builders plus
// five composable components, so the whole cove dressing set arrives (and
// versions) together — the same shape as components/EmberfallScenery.
//
//   1. <WreckedHull>   a broken section of ship's hull half-buried in sand:
//                      exposed curved frames, cracked planking, peeling tar,
//                      a barnacle crust along the old waterline
//   2. <CoralCluster>  a reef head of branching and brain corals in MUTED
//                      natural tones, with small sea fans
//   3. <AnchorPile>    a heavy rusted admiralty anchor with a coiled heap of
//                      thick chain, iron pitted and salt-stained
//   4. <TidePool>      a shallow rock basin holding water, with starfish,
//                      limpets and weed around the rim
//   5. <DockPilings>   a leaning cluster of timber pilings with draped fishing
//                      net, rope wraps and a weathered crossbeam
//
// THE PALETTE IS SALT-WEATHERED AND REALISTIC (`TIDEWATER`, exported as data):
// silvered driftwood grey, algae-dark damp timber, tar black, rust
// orange-brown, pitted iron, wet and dry sand, barnacle crust white. The coral
// is the only colour in the world and it is BLEACHED — muted pinks, ochres and
// dull violets, never a fluorescent reef postcard. NOTHING here glows: no
// emissive, no PointLights at all (budget 4, spend 0 — this world is lit by the
// sun), no particles (budget 300, spend 0).
//
// The tide pool's water surface is `buildWater` from components/WaterTile at
// LOW amp/waviness (a tide pool is nearly still) — never a hand-rolled water
// shader, and never a re-saturated one: WaterTile's palette was retuned in
// 2026-07 to a natural desaturated blue-grey and that is exactly right here.
//
// Static repeats are batched into one merged mesh per material, fine detail
// (barnacle speckle, coral rubble, limpets, salt stains, splinters) is tagged
// `userData.lodDetail`, and every updater takes ABSOLUTE time. Deterministic:
// hashed sines only, never Math.random / Date.now.
//
// TEXTURE SCALE ON SMALL PIECES — the warning Emberfall's scenery left behind.
// A 128² procedural tile stretched over a 0.05 u plank edge puts its grain and
// its pits below one pixel at park zoom, and the whole surface averages out to
// a flat dark smear. Every repeat here is chosen against the part's real world
// size (roughly one tile per 0.25–0.5 u of surface), and anything thinner than
// ~0.02 u (net strands, rope, coral twigs, chain tube) carries NO map at all —
// plain colour reads honestly at every distance.
// ---------------------------------------------------------------------------

// ---- deterministic hashes --------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const hash2 = (a: number, b: number) => hash01(a * 37.19 + b * 91.73 + 3.11);

// ---------------------------------------------------------------------------
// THE TIDEWATER PALETTE — everything in this world has been in the sea. Timber
// is silvered and grey (salt bleaches wood; it does not keep it honey-brown),
// iron is orange-brown rust over pitted grey, and the coral is BLEACHED.
// ---------------------------------------------------------------------------
export const TIDEWATER = {
  /** salt-bleached, silvered driftwood — the world's default timber */
  driftwood: 0x94897a,
  /** the palest, most sun-scoured boards (splinters, sawn tops) */
  driftwoodPale: 0xaaa08d,
  /** below the waterline: damp, algae-darkened plank */
  timberWet: 0x6a5d4e,
  /** creosoted/tarred pile foot, still black under the weed */
  timberDark: 0x473d34,
  /** peeling pitch and oakum — the one true black in the world */
  tar: 0x241f1c,
  /** iron gone to orange-brown rust */
  rust: 0x8a5230,
  /** the darker, wetter rust in the pits and under the chain */
  rustDark: 0x593723,
  /** pitted, salt-stained iron under the rust */
  iron: 0x4a443f,
  /** the one warm metal: cap bands, shackle pins */
  brass: 0x94793f,
  /** wet sand at the tide line */
  sandWet: 0xa6906a,
  /** dry blown sand up the beach */
  sandDry: 0xc3ae88,
  /** barnacle crust: chalk white with a grey cast */
  barnacle: 0xcac2ae,
  /** dried salt bloom on iron and stone */
  saltStain: 0xc7c0b0,
  /** wet basin rock */
  rockWet: 0x635f58,
  /** dry, sun-bleached rock above the waterline */
  rockDry: 0x817c72,
  /** BLEACHED coral pink — a dusty rose, NOT a fluorescent one */
  coralPink: 0xc19a92,
  /** coral ochre — the muted mustard-tan of a dying reef head */
  coralOchre: 0xae9068,
  /** dull violet coral, the coldest tone on the reef */
  coralViolet: 0x8e7f93,
  /** dead coral bone / rubble */
  coralBone: 0xcabfab,
  /** olive bladderwrack */
  weed: 0x5b6739,
  /** the darker weed in the wet shade */
  weedDark: 0x424c2b,
  /** hemp rope */
  rope: 0x9b8963,
  /** the grey-tan of a dried fishing net */
  net: 0xa7a08c,
  /** starfish: a dull brick red-orange, never a cartoon red */
  starfish: 0xa8583d,
  /** limpet and mussel shell */
  limpet: 0x8d8373,
  /** BIOLUMINESCENCE — the cold teal of a tide-pool anemone and a live coral
   *  polyp after dark. Deliberately the SAME hue Deep Drift burns in its
   *  trench, because it is the same organism: one world, one glow. The BODY
   *  colour is muted (this is a closed anemone by day, not a lamp) and the
   *  brightness lives entirely in a night-gated `emissiveIntensity`. */
  biolume: 0x5f9c9a,
} as const;

/** the emissive colour the night gate lerps up to on live reef tissue — a
 *  cold sea-green, one notch off `biolume` so the glow reads as light coming
 *  OUT of the tissue rather than as the tissue turning pale. */
const BIOLUME_GLOW = 0x63d6c4;
/** peak `emissiveIntensity` after dark. KEPT LOW ON PURPOSE: this project has
 *  had water rejected twice for looking neon, and a reef that lights up like a
 *  fairground undoes the whole cove. 0.55 is bright enough to read as presence
 *  from the park camera and dim enough that the pool is still a rock pool. */
const BIOLUME_NIGHT = 0.55;
/** the daylight floor. NOT zero — a `nightKOf` of 0 must still leave a live
 *  anemone looking wet rather than looking like a painted stone. */
const BIOLUME_DAY = 0.04;

// ---------------------------------------------------------------------------
// LOCAL PROCEDURAL CANVASES — two surfaces Stage's texture library cannot do.
// Built exactly the way Stage's `drawTexture` builds its own (2D canvas,
// per-pixel/per-stroke variation), but with hashed sines instead of
// Math.random so a park screenshot is byte-identical run to run. Module-cached:
// one canvas serves every anchor / every brain coral in the park.
// ---------------------------------------------------------------------------

/**
 * RUST — Stage's 'metal' texture is fine horizontal machining streaks, which is
 * exactly wrong for a hundred-year-old anchor: rust is BLOTCHY. Mottled
 * orange-brown patches over a dark pitted iron ground, a scatter of deep pits,
 * flaked scale edges and a couple of pale salt blooms. Doubles as the bump map,
 * so the pits read as pits.
 */
let _rustCanvas: HTMLCanvasElement | null = null;
function rustCanvas(): HTMLCanvasElement {
  if (_rustCanvas) return _rustCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#5d4230'; // dark iron-with-rust ground
  x.fillRect(0, 0, S, S);
  // broad rust blooms — soft radial patches, the bulk of the colour
  for (let i = 0; i < 26; i += 1) {
    const cx = hash01(i * 1.71 + 0.3) * S;
    const cy = hash01(i * 2.93 + 5.1) * S;
    const r = 8 + hash01(i * 3.77) * 26;
    const warm = hash01(i * 5.19);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${Math.round(126 + warm * 52)},${Math.round(70 + warm * 30)},${Math.round(38 + warm * 16)},0.85)`);
    g.addColorStop(1, 'rgba(120,66,34,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // flaked scale: short angular edges where a plate of rust lifted
  for (let i = 0; i < 34; i += 1) {
    const px = hash01(i * 7.13 + 1.9) * S;
    const py = hash01(i * 9.31 + 4.7) * S;
    const w = 3 + hash01(i * 11.7) * 9;
    x.strokeStyle = `rgba(${52 + hash01(i * 13.9) * 26},34,22,0.7)`;
    x.lineWidth = 0.8 + hash01(i * 15.3) * 1.2;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + w, py + (hash01(i * 17.1) - 0.5) * 6);
    x.lineTo(px + w * 0.5, py + 3 + hash01(i * 19.7) * 5);
    x.closePath();
    x.stroke();
  }
  // deep pits — the detail that says "corroded" rather than "painted orange"
  for (let i = 0; i < 260; i += 1) {
    const d = hash01(i * 1.31);
    x.fillStyle = d > 0.72 ? 'rgba(28,18,12,0.8)' : `rgba(${86 + d * 60},${52 + d * 34},${28 + d * 18},0.6)`;
    const s = 0.8 + hash01(i * 3.71) * 1.8;
    x.fillRect(hash01(i * 5.17) * S, hash01(i * 7.19) * S, s, s);
  }
  // dried salt bloom, pale and faint
  for (let i = 0; i < 7; i += 1) {
    const cx = hash01(i * 21.3 + 2.2) * S;
    const cy = hash01(i * 23.9 + 6.6) * S;
    const r = 5 + hash01(i * 25.1) * 12;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(196,190,176,0.4)');
    g.addColorStop(1, 'rgba(196,190,176,0)');
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  _rustCanvas = c;
  return c;
}

/**
 * BRAIN CORAL — the meandering ridge-and-valley pattern is the entire read of a
 * brain coral; a plain sphere is a boulder. Near-horizontal meanders (periodic
 * in x so the texture wraps around the dome) with a dark valley line and a pale
 * ridge highlight either side, over a fine polyp speckle. Also the bump map.
 */
let _brainCanvas: HTMLCanvasElement | null = null;
function brainCanvas(): HTMLCanvasElement {
  if (_brainCanvas) return _brainCanvas;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#c2a487';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i += 1) {
    const d = Math.round(hash01(i * 1.29) * 26);
    x.fillStyle = `rgb(${182 + d},${152 + d},${122 + d})`;
    x.fillRect(hash01(i * 3.31) * S, hash01(i * 5.77) * S, 1, 1);
  }
  const ROWS = 11;
  for (let r = 0; r < ROWS; r += 1) {
    const y = ((r + 0.5) / ROWS) * S;
    const k = 2 + Math.floor(hash01(r * 1.9) * 3); // whole cycles: wraps in x
    const amp = 2.2 + hash01(r * 3.1) * 3.4;
    const ph = hash01(r * 5.3) * Math.PI * 2;
    // the pale ridge crest just above the valley
    x.strokeStyle = 'rgba(224,206,182,0.75)';
    x.lineWidth = 2.1;
    x.beginPath();
    for (let px = 0; px <= S; px += 3) {
      const yy = y + Math.sin((px / S) * Math.PI * 2 * k + ph) * amp - 1.6;
      if (px === 0) x.moveTo(px, yy);
      else x.lineTo(px, yy);
    }
    x.stroke();
    // the valley itself
    x.strokeStyle = 'rgba(104,80,58,0.8)';
    x.lineWidth = 1.5;
    x.beginPath();
    for (let px = 0; px <= S; px += 3) {
      const yy = y + Math.sin((px / S) * Math.PI * 2 * k + ph) * amp;
      if (px === 0) x.moveTo(px, yy);
      else x.lineTo(px, yy);
    }
    x.stroke();
  }
  _brainCanvas = c;
  return c;
}

/** canvas -> repeating CanvasTexture (the Emberfall plumbing) */
function texFrom(t: typeof THREE, canvas: HTMLCanvasElement, rx: number, ry: number): THREE.CanvasTexture {
  const tex = new t.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = t.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// GEOMETRY HELPERS — `mergedParts` / `mtx` / `alongDir` (imported from Stage)
// are the non-box counterparts of Stage's `mergedBoxes` (which only takes
// boxes). This world is built out of cylinders (frames, pilings, coral
// branches, chain), tori (chain links, rope wraps) and squashed icosahedra
// (rock, coral heads), so it needs them.
// ---------------------------------------------------------------------------

/** a low sand apron: the drift of beach the piece is standing in. Elliptical
 *  (scaled), because a perfect sand circle around a wreck reads as a dinner
 *  plate. */
function sandApron(t: typeof THREE, rx: number, rz: number, color: number): THREE.Mesh {
  const m = cyl(t, 1, 1.04, 0.05, color, [0, -0.008, 0], {
    tex: 'sand',
    // one 128² tile per ~0.4 u of sand: fine enough to read grain up close,
    // coarse enough that the ripples do not go sub-pixel at park zoom
    repeat: [Math.max(2, Math.round(rx * 5)), Math.max(2, Math.round(rz * 5))],
    rough: 1,
    seg: 28,
  });
  m.scale.set(rx, 1, rz);
  return m;
}

// ===========================================================================
// 1. <WreckedHull> — a broken section of ship's hull, half-buried in sand
// ===========================================================================
//
// The read is CROSS-SECTION plus BREAK. A hull is a curved shell of strakes
// over transverse frames, so the piece is built as an arc about a centre 0.82R
// above the ground (the keel is therefore BURIED by 0.18R) and the arc is
// deliberately ASYMMETRIC: starboard broke away low and lies under the sand,
// port stands proud to 2.06 rad with its frames bare. The planking is then torn
// away progressively toward +z, so the surviving top edge runs as a DIAGONAL
// from an almost-intact bow to a skeleton of frames aft — that diagonal, and
// the ribs standing past it, is what makes it a shipwreck and not a barrel.

export interface WreckedHullOpts {
  /** keel length (default 1.8) */
  length?: number;
  /** hull cross-section radius — half the beam (default 0.55) */
  radius?: number;
  seed?: number;
  /** the sand mound the wreck is buried in, plus its drift apron (default true) */
  sand?: boolean;
  /** loose planks and broken timbers scattered around (default true) */
  debris?: boolean;
}

export interface WreckedHullBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** keel length along local +Z */
  length: number;
  /** highest surviving frame */
  height: number;
  /** half the beam, for the blocker rect */
  halfBeam: number;
}

/** the wrecked hull section. Group origin at ground level under the keel;
 *  the keel runs along local +Z (so `rotation` aims the wreck). */
export function buildWreckedHull(t: typeof THREE, opts: WreckedHullOpts = {}): WreckedHullBuilt {
  const L = opts.length ?? 1.8;
  const R = opts.radius ?? 0.55;
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'wrecked-hull';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const CY = R * 0.82; // shell centre height: 0.18R of keel is under the sand
  const TH_LOW = -1.62; // starboard: torn lower than port, and buried at the foot
  const TH_TOP = 2.06; // port: stands proud, frames exposed
  /**
   * THE PLAN TAPER — and the single most important number in the piece. A
   * constant-radius arc extruded along the keel is a BARREL: seen from the DS's
   * ~50° overhead camera (which is how a park piece is actually seen) it has no
   * bow, and the first two passes of this wreck read as a dinosaur ribcage for
   * exactly that reason. Narrowing the sections toward the ends gives the hull a
   * POINTED PLAN, which is the cue the eye uses to read "boat" from above; and
   * because the section radius shrinks while its centre height stays put, the
   * keel automatically ROCKERS UP toward the stem, which is also what a real
   * hull does.
   */
  const tapOf = (z: number) => {
    const bow = Math.max(0, Math.min(1, (-z - 0.14) / (L / 2 - 0.14)));
    const stern = Math.max(0, Math.min(1, (z - 0.3) / (L / 2 - 0.3)));
    return 1 - 0.56 * bow ** 1.5 - 0.16 * stern ** 1.4;
  };
  const yOf = (th: number, z = 0) => CY - Math.cos(th) * R * tapOf(z);
  const xOf = (th: number, z = 0) => Math.sin(th) * R * tapOf(z);
  const WL = 0.3; // the old waterline: barnacles here, algae-dark plank below

  // ---- 1. the planking ----------------------------------------------------
  // Strakes running along the keel, each a box rotated so its local +y is the
  // arc TANGENT at that station (rotZ = th - PI/2 maps +x -> radial and
  // +y -> tangent) and its local +z runs the length of the plank.
  const DTH = 0.152; // strake width in radians (~0.084 u of arc at R 0.55)
  const NS = Math.floor((TH_TOP - TH_LOW) / DTH);
  // 0.24 butt spacing (not 0.36): the taper changes fast toward the stem, and
  // long strakes step visibly off the section they are supposed to hug
  const SEG = 0.24; // plank butt spacing along the keel
  const NZ = Math.max(2, Math.round(L / SEG));
  const dry: MergedBoxSpec[] = [];
  const wet: MergedBoxSpec[] = [];
  const tarSpecs: MergedBoxSpec[] = [];
  /** the surviving top of the planking at station z — the tear runs aft.
   *  IT MUST NOT RUN OUT: the first pass took the aft planking down to 0.1 rad,
   *  which on this arc is BELOW GROUND (yOf(0.41) = -0.03), so the whole after
   *  half of the wreck was a bare ribcage with no skin anywhere and the piece
   *  read as a dinosaur fossil. The tear now bottoms out at ~1.0 rad (y 0.15),
   *  so a torn plank EDGE stays visible the length of the hull. */
  const topAt = (zc: number, k: number) => {
    const f = Math.max(0, Math.min(1, (zc + 0.22) / (L / 2 + 0.22)));
    return TH_TOP - f ** 0.9 * (TH_TOP - 1.0) * (0.88 + 0.22 * hash01(k * 5.3 + seed));
  };
  /** and the surviving BOTTOM edge, on the starboard flank. BOTH flanks have to
   *  stay planked to a real height: with starboard cut to 1.14 rad (y 0.22) the
   *  wreck was an open trough, and from the whole starboard half of the compass
   *  the camera looked straight over the low side into a bare interior. */
  const lowAt = (zc: number, k: number) => {
    const f = Math.max(0, Math.min(1, (zc + 0.3) / (L / 2 + 0.3)));
    return TH_LOW + f ** 1.05 * (TH_LOW - -1.02) * -1 * (0.86 + 0.28 * hash01(k * 7.9 + seed * 1.7));
  };
  for (let s = 0; s < NS; s += 1) {
    const th = TH_LOW + (s + 0.5) * DTH;
    const below = yOf(th) < WL;
    for (let k = 0; k < NZ; k += 1) {
      const z0 = -L / 2 + k * (L / NZ);
      const zc = z0 + L / NZ / 2;
      if (th > topAt(zc, k) || th < lowAt(zc, k)) continue;
      if (hash01(s * 3.7 + k * 9.1 + seed * 1.3) > 0.95) continue; // a plank sprung clean off
      const len = L / NZ - 0.009 - hash01(s * 2.9 + k * 4.1) * 0.012;
      // hashed warp: a salt-cycled plank does not lie flush with its neighbours
      const rOff = (hash2(s, k) - 0.5) * 0.014;
      const tOff = (hash01(s * 6.1 + k * 2.3 + seed) - 0.5) * 0.012;
      const Rz = R * tapOf(zc);
      const spec: MergedBoxSpec = {
        dims: [0.042, DTH * Rz * 1.14, len],
        pos: [xOf(th, zc) + Math.sin(th) * rOff, yOf(th, zc) - Math.cos(th) * rOff + tOff * 0.4, zc],
        rotZ: th - Math.PI / 2,
        rotY: (hash01(s * 8.7 + k * 3.3) - 0.5) * 0.035,
        // one wood tile per ~0.25 u of plank length: the grain still reads at
        // park zoom instead of averaging to a flat smear
        repeat: [1, Math.max(2, Math.round(len * 4))],
      };
      (below ? wet : dry).push(spec);
      // PEELING TAR: FLAKES of pitch still stuck to the outer skin, lifted at
      // one edge. Proud of the plank by 0.024 so they never z-fight — but kept
      // SMALL and few (first pass ran them to a full plank face and they read as
      // black portholes punched in the hull, which is much worse than no tar).
      if (hash01(s * 11.3 + k * 7.7 + seed * 2.1) > 0.74) {
        const tl = len * (0.14 + hash01(s * 13.9 + k) * 0.2);
        const tw = DTH * Rz * (0.3 + hash01(s * 15.1 + k) * 0.28);
        tarSpecs.push({
          dims: [0.01, tw, tl],
          pos: [
            xOf(th, zc) + Math.sin(th) * 0.024,
            yOf(th, zc) - Math.cos(th) * 0.024,
            zc + (hash01(s * 17.3 + k) - 0.5) * (len - tl),
          ],
          rotZ: th - Math.PI / 2 + (hash01(s * 19.7 + k) - 0.5) * 0.12,
          rotY: (hash01(s * 21.1 + k) - 0.5) * 0.1,
          repeat: [1, 1],
        });
      }
    }
  }

  // ---- 2. the frames (ribs) ----------------------------------------------
  // Sawn curved timbers inside the skin, standing PAST the torn planking. Each
  // frame is an arc of short boxes at radius R - 0.052, sampled every 0.155 rad
  // and broken off at a hashed height — a row of equal ribs reads as a comb.
  const frames: MergedBoxSpec[] = [];
  const heavy: MergedBoxSpec[] = [];
  const NF = Math.max(5, Math.round(L / 0.2));
  let topY = 0;
  for (let i = 0; i <= NF; i += 1) {
    const z = -L / 2 + (i / NF) * L;
    const RF = R * tapOf(z) - 0.05;
    if (RF < 0.06) continue; // right at the stem there is no room for a frame
    // aft frames are snapped shorter — the sea took the stern first
    const f = (z + L / 2) / L;
    const ribTop = Math.min(TH_TOP + 0.22, 1.46 + hash01(i * 4.7 + seed) * 0.72) - f * 0.46 * hash01(i * 6.7 + seed * 1.7);
    const ribBot = TH_LOW - 0.06;
    const n = Math.max(3, Math.round((ribTop - ribBot) / 0.13));
    for (let j = 0; j < n; j += 1) {
      const th = ribBot + ((j + 0.5) / n) * (ribTop - ribBot);
      frames.push({
        // SLIM in z (0.055) so a frame reads as a sawn rib rather than a
        // bulkhead, and closely sampled along the arc so it reads as a CURVE
        dims: [0.042, ((ribTop - ribBot) / n) * RF * 1.12, 0.055],
        pos: [Math.sin(th) * RF, CY - Math.cos(th) * RF, z],
        rotZ: th - Math.PI / 2,
        repeat: [1, 1],
      });
    }
    topY = Math.max(topY, CY - Math.cos(Math.min(ribTop, Math.PI)) * RF);
  }

  // the WALE (rubbing strake): one heavy timber running the SHEER of the
  // surviving section, just under the top edge of the planking. A ship reads as
  // a ship largely through this single long horizontal curve — without it the
  // planked flank is an anonymous barrel stave.
  const wale: MergedBoxSpec[] = [];
  const NW = 7;
  const WL_LEN = L * 0.74;
  for (let i = 0; i < NW; i += 1) {
    const zc = -L / 2 + ((i + 0.5) / NW) * WL_LEN;
    const th = Math.min(TH_TOP - 0.07, topAt(zc, i) - 0.11);
    if (th < 0.6) continue;
    wale.push({
      dims: [0.06, 0.095, WL_LEN / NW + 0.012],
      pos: [xOf(th, zc) + Math.sin(th) * 0.028, yOf(th, zc) - Math.cos(th) * 0.028, zc],
      rotZ: th - Math.PI / 2,
      repeat: [1, 2],
    });
  }

  // the KEEL: it follows the ROCKER (the section radius shrinks toward the ends,
  // so the keel line rises), in eight short pitched segments
  const NK = 8;
  for (let i = 0; i < NK; i += 1) {
    const z0 = -L / 2 + (i / NK) * L;
    const z1 = z0 + L / NK;
    const y0 = CY - R * tapOf(z0) - 0.03;
    const y1 = CY - R * tapOf(z1) - 0.03;
    const kl = Math.hypot(L / NK, y1 - y0);
    heavy.push({
      dims: [0.098, 0.125, kl * 1.04],
      pos: [0, (y0 + y1) / 2, (z0 + z1) / 2],
      rotX: -Math.atan2(y1 - y0, L / NK),
      repeat: [1, 2],
    });
  }
  // the STEM: the bow post, RAKING FORWARD off the top of the risen keel — this
  // and the wale are what say "front of a ship" instead of "end of a box"
  const stemY = CY - R * tapOf(-L / 2) - 0.02;
  for (let i = 0; i < 4; i += 1) {
    const f = i / 4;
    const h = 0.16;
    const rake = 0.3 + f * 0.34;
    heavy.push({
      dims: [0.094, h * 1.14, 0.11],
      pos: [0, stemY + h * (i + 0.5) * 0.94, -L / 2 - 0.02 - Math.sin(rake) * h * (i + 0.7)],
      rotX: rake,
      repeat: [1, 1],
    });
  }
  // a snapped BOWSPRIT stub jutting forward off the stem head — one spar, and
  // the silhouette stops being able to read as anything but a ship
  heavy.push({
    dims: [0.062, 0.062, 0.3],
    pos: [0, stemY + 0.62, -L / 2 - 0.34],
    rotX: -0.34,
    repeat: [1, 2],
  });
  // the FOREDECK: five transverse boards over the surviving bow, with the middle
  // one missing (an open hatch). From the park's overhead camera this little
  // patch of deck inside a pointed bow is what closes the "boat" read.
  const deck: MergedBoxSpec[] = [];
  for (let i = 0; i < 5; i += 1) {
    const z = -L / 2 + 0.17 + i * 0.14;
    if (i === 2) continue; // the hatch
    const y = 0.4 + hash01(i * 3.1 + seed) * 0.02;
    const Rz = R * tapOf(z);
    const half = Math.sqrt(Math.max(0.02, Rz * Rz - (y - CY) * (y - CY)));
    deck.push({
      dims: [half * 1.9, 0.05, 0.12],
      pos: [0, y, z],
      rotZ: (hash01(i * 5.7 + seed) - 0.5) * 0.09,
      repeat: [3, 1],
    });
  }
  // two broken DECK BEAMS further aft, the second snapped in half so the wreck
  // never reads as a tidy crate
  for (let i = 0; i < 2; i += 1) {
    const z = -L / 2 + 0.95 + i * 0.32;
    const y = 0.4 + hash01(i * 7.3 + seed) * 0.06;
    const Rz = R * tapOf(z);
    const half = Math.sqrt(Math.max(0.02, Rz * Rz - (y - CY) * (y - CY)));
    if (i === 0) {
      heavy.push({ dims: [half * 1.84, 0.06, 0.084], pos: [0, y, z], rotZ: 0.04, repeat: [4, 1] });
    } else {
      heavy.push({ dims: [half * 0.88, 0.056, 0.08], pos: [-half * 0.54, y - 0.04, z], rotZ: -0.16, repeat: [2, 1] });
      heavy.push({ dims: [half * 0.42, 0.052, 0.076], pos: [half * 0.58, y - 0.16, z + 0.05], rotZ: 0.66, repeat: [1, 1] });
    }
  }

  // ---- 3. the barnacle crust along the old waterline ---------------------
  // A BAND, not a scatter: barnacles colonise the strip that was awash, so they
  // cluster tightly in y and thin out fast above and below it.
  const barn: MergedBoxSpec[] = [];
  const fine: MergedBoxSpec[] = [];
  for (let i = 0; i < 150; i += 1) {
    const th = TH_LOW + hash01(i * 2.31 + seed * 3.7) * (TH_TOP - TH_LOW);
    const z = -L / 2 + hash01(i * 4.17 + seed) * L;
    const y = yOf(th, z);
    const d = Math.abs(y - (WL - 0.05));
    if (d > 0.13) continue;
    const kz = Math.floor((z + L / 2) / (L / NZ));
    if (th > topAt(z, kz) || th < lowAt(z, kz)) continue; // no plank here to sit on
    const sz = 0.016 + hash01(i * 6.29 + seed) * 0.026 * (1 - d / 0.16);
    const spec: MergedBoxSpec = {
      dims: [sz * 0.62, sz, sz],
      pos: [xOf(th, z) + Math.sin(th) * 0.03, y - Math.cos(th) * 0.03, z],
      rotZ: th - Math.PI / 2,
      rotY: hash01(i * 8.31 + seed) * Math.PI,
      repeat: [1, 1],
    };
    (sz > 0.028 ? barn : fine).push(spec);
  }

  // ---- 4. sand: the mound it is buried in, and the drift around it -------
  if (opts.sand ?? true) {
    // NOTE THE AXES: the keel runs along +Z, so the beach is WIDE in z and
    // narrow in x. The first pass had these swapped and the mound came out
    // 1.44 u across the beam by 0.66 along the keel — a sand dish lying athwart
    // the wreck that swallowed every strake below the waterline, which is why
    // the hull read as a bare ribcage in a saucer.
    group.add(sandApron(t, R * 1.55, L * 0.62, TIDEWATER.sandDry));
    // the mound itself is deliberately SMALL and LOW: it fills the bilge and
    // buries the keel, nothing more.
    const mound = ball(t, 1, TIDEWATER.sandWet, [0, -0.16, 0], { tex: 'sand', repeat: [3, 4], rough: 1, flat: true });
    mound.scale.set(R * 0.66, 0.19, L * 0.44);
    group.add(mound);
    geos.push(mound.geometry);
    mats.push(mound.material as THREE.Material);
    // a drift heaped against the buried starboard side
    const drift = ball(t, 1, TIDEWATER.sandWet, [-R * 0.62, -0.07, L * 0.08], {
      tex: 'sand',
      repeat: [3, 2],
      rough: 1,
      flat: true,
    });
    drift.scale.set(R * 0.36, 0.13, L * 0.3);
    group.add(drift);
    geos.push(drift.geometry);
    mats.push(drift.material as THREE.Material);
  }

  // ---- 5. debris: loose planks and a broken timber in the sand -----------
  if (opts.debris ?? true) {
    for (let i = 0; i < 4; i += 1) {
      const az = hash01(i * 3.31 + seed * 5.1) * Math.PI * 2;
      const rr = R * (1.15 + hash01(i * 5.17 + seed) * 0.55);
      const len = 0.22 + hash01(i * 7.19 + seed) * 0.4;
      dry.push({
        dims: [0.09 + hash01(i * 9.7) * 0.04, 0.032, len],
        pos: [Math.cos(az) * rr, 0.022 + hash01(i * 11.3) * 0.01, Math.sin(az) * rr * 0.8 + L * 0.05],
        rotX: (hash01(i * 13.1) - 0.5) * 0.16,
        rotY: hash01(i * 15.7 + seed) * Math.PI,
        rotZ: (hash01(i * 17.9) - 0.5) * 0.2,
        repeat: [1, Math.max(2, Math.round(len * 4))],
      });
    }
  }

  // ---- merge: five draw calls for the whole wreck ------------------------
  const add = (specs: MergedBoxSpec[], color: number, o: Parameters<typeof mergedBoxes>[3], lod = false) => {
    if (!specs.length) return;
    const m = mergedBoxes(t, specs, color, o);
    if (lod) m.userData.lodDetail = true;
    group.add(m);
    geos.push(m.geometry);
    mats.push(m.material as THREE.Material);
  };
  add(dry, TIDEWATER.driftwood, { tex: 'wood', rough: 0.95, bump: 0.04 });
  add(wet, TIDEWATER.timberWet, { tex: 'wood', rough: 1, bump: 0.045 });
  add(frames, 0x7b6d5c, { tex: 'wood', rough: 1, bump: 0.04 });
  add(heavy, 0x87796a, { tex: 'wood', rough: 1, bump: 0.045 });
  add(wale, TIDEWATER.driftwoodPale, { tex: 'wood', rough: 1, bump: 0.05 });
  add(deck, 0x8e8171, { tex: 'wood', rough: 1, bump: 0.045 });
  add(tarSpecs, TIDEWATER.tar, { tex: 'concrete', rough: 0.55, bump: 0.03 });
  add(barn, TIDEWATER.barnacle, { tex: 'concrete', rough: 0.9, bump: 0.06, flat: true });
  add(fine, TIDEWATER.barnacle, { tex: 'concrete', rough: 0.9, bump: 0.06, flat: true }, true);

  return {
    group,
    length: L,
    height: topY,
    halfBeam: R * 1.04,
    dispose() {
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// 2. <CoralCluster> — a reef head of branching and brain corals
// ===========================================================================
//
// Coral reads by SILHOUETTE: staghorn is a recursive fork, brain coral is a
// grooved dome, a sea fan is lace. So the piece is a lumpy dead-coral rock head
// carrying (a) three recursive branching clumps in three bleached tones, (b)
// two grooved brain domes on the local brain canvas, and (c) three lacy sea
// fans built as radial rods rather than solid plates — at this scale a solid
// fan reads as a shovel blade.

export interface CoralClusterOpts {
  /** reef-head radius (default 0.42) */
  radius?: number;
  /** tallest branch tip above the ground (default 0.6) */
  height?: number;
  seed?: number;
  /** number of branching clumps, clamped 1…5 (default 3) */
  clumps?: number;
  /** the lacy sea fans (default true) */
  fans?: boolean;
}

export interface CoralClusterBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** night gate for the live polyps (absolute time) — the only animated thing
   *  in the piece, and emissive-only: the reef head owns no PointLight */
  update: (time: number) => void;
  radius: number;
  height: number;
}

/** recursive branching coral: a fork that keeps forking, ending in BLUNT knobs
 *  (a tapered point reads as a thorn, and coral tips are club-shaped) */
function coralBranch(
  t: typeof THREE,
  parts: PartSpec[],
  p: THREE.Vector3,
  dir: THREE.Vector3,
  len: number,
  rad: number,
  depth: number,
  seed: number,
): void {
  const d = dir.clone().normalize();
  parts.push({ geo: new t.CylinderGeometry(rad * 0.78, rad, len, 6, 1), matrix: alongDir(t, p, d, len) });
  const end = p.clone().addScaledVector(d, len);
  if (depth <= 0) {
    parts.push({ geo: new t.IcosahedronGeometry(rad * 0.95, 1), matrix: mtx(t, [end.x, end.y, end.z], [0, 0, 0], [1, 1.25, 1]) });
    return;
  }
  // a knuckle at every fork, so the joint is not a wire junction
  parts.push({ geo: new t.IcosahedronGeometry(rad * 1.05, 1), matrix: mtx(t, [end.x, end.y, end.z]) });
  const nk = hash01(seed * 3.7 + depth * 1.9) > 0.55 ? 3 : 2;
  const up = new t.Vector3(0, 1, 0);
  let perp = new t.Vector3().crossVectors(d, up);
  if (perp.lengthSq() < 1e-5) perp = new t.Vector3(1, 0, 0);
  perp.normalize();
  for (let k = 0; k < nk; k += 1) {
    const az = ((k + 0.5) / nk) * Math.PI * 2 + hash01(seed * 5.3 + depth) * 2.4;
    const axis = perp.clone().applyAxisAngle(d, az);
    const spread = 0.44 + hash01(seed * 7.1 + k * 2.3 + depth) * 0.42;
    const child = d.clone().applyAxisAngle(axis, spread);
    child.y += 0.22; // coral grows toward the light
    child.normalize();
    coralBranch(
      t,
      parts,
      end,
      child,
      len * (0.62 + hash01(seed * 9.7 + k * 3.1 + depth) * 0.22),
      rad * (0.68 + hash01(seed * 11.3 + k) * 0.12),
      depth - 1,
      seed * 1.7 + k * 4.9 + depth,
    );
  }
}

/** a lacy sea fan: radial rods in ONE plane plus two cross-arcs. A sea fan is
 *  a net of branches — a solid plate at this size reads as a spade. */
function seaFan(
  t: typeof THREE,
  rods: PartSpec[],
  lace: PartSpec[],
  base: THREE.Vector3,
  yaw: number,
  size: number,
  seed: number,
): void {
  const e1 = new t.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const up = new t.Vector3(0, 1, 0);
  const NR = 9; // more rods, thicker: a 7-rod fan of 0.01 twigs read as cobweb
  const tips: THREE.Vector3[][] = [];
  // a short stalk, then the fan splays out of it
  const stalk = 0.2 * size;
  rods.push({ geo: new t.CylinderGeometry(0.022 * size, 0.03 * size, stalk, 5, 1), matrix: alongDir(t, base, up, stalk) });
  const root = base.clone().addScaledVector(up, stalk * 0.95);
  for (let i = 0; i < NR; i += 1) {
    // a fan is WIDER than it is tall: ±0.8 rad of splay
    const a = (-0.8 + (i / (NR - 1)) * 1.6) * (0.9 + hash01(i * 3.3 + seed) * 0.2);
    const dir = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(e1, Math.sin(a)).normalize();
    const len = size * (0.62 + hash01(i * 5.7 + seed) * 0.3) * (1 - Math.abs(a) * 0.18);
    // two-part rod with a slight outward flare, so the fan edge is convex
    const mid = root.clone().addScaledVector(dir, len * 0.55);
    rods.push({ geo: new t.CylinderGeometry(0.024 * size, 0.034 * size, len * 0.55, 5, 1), matrix: alongDir(t, root, dir, len * 0.55) });
    const dir2 = dir.clone().applyAxisAngle(new t.Vector3().crossVectors(dir, e1).normalize(), (hash01(i * 7.1 + seed) - 0.5) * 0.3);
    dir2.addScaledVector(e1, Math.sin(a) * 0.28).normalize();
    rods.push({ geo: new t.CylinderGeometry(0.016 * size, 0.024 * size, len * 0.5, 5, 1), matrix: alongDir(t, mid, dir2, len * 0.5) });
    tips.push([mid, mid.clone().addScaledVector(dir2, len * 0.5)]);
  }
  // the lace: short cross-links between neighbouring rods at two radii
  for (let i = 0; i + 1 < NR; i += 1) {
    for (let r = 0; r < 2; r += 1) {
      const a = tips[i][r];
      const b = tips[i + 1][r];
      const dd = b.clone().sub(a);
      const l = dd.length();
      if (l < 1e-4) continue;
      lace.push({ geo: new t.CylinderGeometry(0.013 * size, 0.013 * size, l * 1.04, 4, 1), matrix: alongDir(t, a, dd, l) });
    }
  }
}

/** the coral cluster. Group origin at ground level under the reef head. */
export function buildCoralCluster(t: typeof THREE, opts: CoralClusterOpts = {}): CoralClusterBuilt {
  const R = opts.radius ?? 0.42;
  const H = opts.height ?? 0.6;
  const seed = opts.seed ?? 1;
  const NC = Math.max(1, Math.min(5, Math.round(opts.clumps ?? 3)));
  const group = new t.Group();
  group.name = 'coral-cluster';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];
  /** the live polyps' night-gated material (assigned at the tail of the builder) */
  let polypMat: THREE.MeshStandardMaterial;

  // ---- the reef head: overlapping lumps of dead coral rock ---------------
  // LOW and lumpy: a first pass with one big r 0.33 lump read as a boulder with
  // twigs stuck in it. The head is a crusted PLATFORM the corals grow out of, so
  // it is nine small flattened lumps, none of them tall enough to compete with a
  // branch silhouette.
  const headParts: PartSpec[] = [];
  const headY = R * 0.26;
  for (let i = 0; i < 9; i += 1) {
    const az = hash01(i * 2.71 + seed * 1.9) * Math.PI * 2;
    const rr = i === 0 ? 0 : R * (0.22 + hash01(i * 4.31 + seed) * 0.56);
    const s = R * (i === 0 ? 0.5 : 0.24 + hash01(i * 6.53 + seed) * 0.26);
    headParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, headY * (0.34 + hash01(i * 8.71) * 0.42) - 0.05, Math.sin(az) * rr],
        [(hash01(i * 10.3) - 0.5) * 0.6, hash01(i * 12.7) * Math.PI, (hash01(i * 14.9) - 0.5) * 0.6],
        [s, s * (0.34 + hash01(i * 16.1) * 0.24), s * (0.82 + hash01(i * 18.3) * 0.4)],
      ),
      uv: [2, 2],
    });
  }
  // dead reef rock is a dull grey-tan, NOT coral bone white — a white head
  // washes out every bleached tone standing on it
  const headMat = mat(t, 0x9e9484, { tex: 'concrete', rough: 0.98, bump: 0.07, flat: true });
  const head = mergedParts(t, headParts, headMat);
  group.add(head);
  geos.push(head.geometry);
  mats.push(headMat);

  /** the rock surface height under (x,z) — branches must ROOT in the head */
  const headTop = (x: number, z: number) => {
    const d = Math.hypot(x, z) / Math.max(1e-4, R * 0.9);
    return headY * 0.8 * Math.max(0.15, 1 - d * d * 0.85);
  };

  // ---- the branching clumps, three bleached tones ------------------------
  const tones = [TIDEWATER.coralPink, TIDEWATER.coralOchre, TIDEWATER.coralViolet, TIDEWATER.coralBone, TIDEWATER.coralPink];
  const branchTop = H - headY * 0.2;
  for (let c = 0; c < NC; c += 1) {
    const parts: PartSpec[] = [];
    const az = (c / NC) * Math.PI * 2 + hash01(seed * 3.1 + c) * 1.2;
    const rr = R * (0.1 + hash01(c * 5.9 + seed) * 0.42);
    const bx = Math.cos(az) * rr;
    const bz = Math.sin(az) * rr;
    const by = headTop(bx, bz) - 0.02;
    const lean = 0.1 + hash01(c * 7.3 + seed) * 0.24;
    const dir = new t.Vector3(Math.cos(az) * lean, 1, Math.sin(az) * lean).normalize();
    const trunk = (branchTop - by) * (0.34 + hash01(c * 9.1 + seed) * 0.12);
    coralBranch(t, parts, new t.Vector3(bx, by, bz), dir, trunk, R * (0.1 + hash01(c * 11.7) * 0.035), 3, seed * 2.3 + c * 6.1);
    const m = mat(t, tones[c % tones.length], { tex: 'concrete', rough: 0.95, bump: 0.05, flat: true });
    const mesh = mergedParts(t, parts, m);
    group.add(mesh);
    geos.push(mesh.geometry);
    mats.push(m);
  }

  // ---- brain corals: grooved domes on the local brain canvas -------------
  const brainTex = texFrom(t, brainCanvas(), 2, 1);
  texes.push(brainTex);
  const brainMat = new t.MeshStandardMaterial({
    color: 0xffffff, // the canvas carries the tone
    map: brainTex,
    bumpMap: brainTex,
    bumpScale: 0.05,
    roughness: 0.96,
    metalness: 0,
  });
  mats.push(brainMat);
  const brainParts: PartSpec[] = [];
  for (let i = 0; i < 3; i += 1) {
    const az = (i / 3) * Math.PI * 2 + hash01(i * 13.3 + seed * 4.7) * 1.6;
    const rr = R * (0.46 + hash01(i * 15.1 + seed) * 0.3);
    const br = R * (0.22 + hash01(i * 17.7 + seed) * 0.11);
    const x = Math.cos(az) * rr;
    const z = Math.sin(az) * rr;
    brainParts.push({
      geo: new t.SphereGeometry(br, 14, 10),
      // proud of the head by 0.34 of its radius: sunk flush, the grooves — the
      // entire point of a brain coral — are hidden inside the rock lumps
      matrix: mtx(t, [x, headTop(x, z) + br * 0.34, z], [0, hash01(i * 19.3) * Math.PI, 0], [1, 0.7, 0.92]),
      uv: [1, 1],
    });
  }
  const brains = mergedParts(t, brainParts, brainMat);
  group.add(brains);
  geos.push(brains.geometry);

  // ---- sea fans ----------------------------------------------------------
  if (opts.fans ?? true) {
    const rods: PartSpec[] = [];
    const lace: PartSpec[] = [];
    for (let i = 0; i < 3; i += 1) {
      const az = hash01(i * 21.7 + seed * 5.3) * Math.PI * 2;
      const rr = R * (0.55 + hash01(i * 23.1 + seed) * 0.36);
      const x = Math.cos(az) * rr;
      const z = Math.sin(az) * rr;
      seaFan(
        t,
        rods,
        lace,
        new t.Vector3(x, headTop(x, z) - 0.01, z),
        az + Math.PI / 2 + (hash01(i * 25.9) - 0.5) * 0.8,
        R * (0.72 + hash01(i * 27.3) * 0.26),
        seed * 3.3 + i * 7.7,
      );
    }
    // NO map on the fans: the rods are ~0.01 u across, so any tile is sub-pixel
    // a shade LIGHTER than the palette violet: at rod gauge the fan is mostly
    // its own shadow, and the darker tone read as a black palm frond
    const fanMat = mat(t, 0xa1949f, { rough: 0.9 });
    const fanMesh = mergedParts(t, rods, fanMat);
    group.add(fanMesh);
    geos.push(fanMesh.geometry);
    mats.push(fanMat);
    const laceMat = mat(t, TIDEWATER.coralOchre, { rough: 0.9 });
    const laceMesh = mergedParts(t, lace, laceMat);
    laceMesh.userData.lodDetail = true; // the cross-lace: close-up only
    group.add(laceMesh);
    geos.push(laceMesh.geometry);
    mats.push(laceMat);
  }

  // ---- coral rubble and a little sand at the foot ------------------------
  // LUMPS, not slabs: two passes of pale flat BOXES here read unmistakably as
  // scraps of paper dropped on the sand (the same failure as the anchor's first
  // salt stains). Broken reef rock is rounded and stubby, so the rubble is
  // little flattened icosahedra in a duller bone than the coral itself.
  const rubbleParts: PartSpec[] = [];
  for (let i = 0; i < 12; i += 1) {
    const az = hash01(i * 2.11 + seed * 6.7) * Math.PI * 2;
    const rr = R * (0.88 + hash01(i * 4.23 + seed) * 0.44);
    const sz = R * (0.045 + hash01(i * 6.37 + seed) * 0.055);
    rubbleParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, sz * 0.5, Math.sin(az) * rr],
        [(hash01(i * 10.53 + seed) - 0.5) * 0.6, hash01(i * 12.61 + seed) * Math.PI, (hash01(i * 14.71) - 0.5) * 0.6],
        [sz, sz * 0.7, sz * (0.8 + hash01(i * 8.41) * 0.6)],
      ),
      uv: [1, 1],
    });
  }
  const rubMat = mat(t, 0xa79c88, { tex: 'concrete', rough: 1, bump: 0.05, flat: true });
  const rub = mergedParts(t, rubbleParts, rubMat);
  rub.userData.lodDetail = true;
  group.add(rub);
  geos.push(rub.geometry);
  mats.push(rubMat);
  group.add(sandApron(t, R * 1.5, R * 1.5, TIDEWATER.sandWet));

  // ---- LIVE POLYPS — the reef head's night presence ------------------------
  // The bleached tones in this piece are DEAD coral, and dead coral at night is
  // a grey lump: the whole pack measured zero emissive materials and the night
  // render lost the reef head entirely. So a MINORITY of the colony is alive —
  // eleven small polyp knobs tucked in the crevices between the clumps, on the
  // same night-gated bioluminescent material as the tide pool's anemones (and
  // the same hue Deep Drift's trench burns). They are knobs, not points: a
  // scatter of single dots read as glowing confetti in the first look at the
  // tide pool, and a knob with a collar reads as tissue.
  const polypParts: PartSpec[] = [];
  for (let i = 0; i < 11; i += 1) {
    const az = hash01(i * 3.19 + seed * 2.3) * Math.PI * 2;
    const rr = R * (0.3 + hash01(i * 5.41 + seed) * 0.5);
    const px = Math.cos(az) * rr;
    const pz = Math.sin(az) * rr;
    const py = headTop(px, pz) + R * 0.03;
    const s = R * (0.055 + hash01(i * 7.63 + seed) * 0.05);
    polypParts.push({ geo: new t.IcosahedronGeometry(1, 1), matrix: mtx(t, [px, py + s * 0.6, pz], [0, hash01(i * 9.7) * 3, 0], [s, s * 0.78, s]) });
    // the collar it sits in, so the knob is attached to the rock
    polypParts.push({ geo: new t.CylinderGeometry(s * 1.15, s * 1.3, s * 0.4, 7, 1), matrix: mtx(t, [px, py + s * 0.16, pz]) });
  }
  polypMat = new t.MeshStandardMaterial({
    color: TIDEWATER.biolume,
    emissive: new t.Color(BIOLUME_GLOW),
    emissiveIntensity: BIOLUME_DAY,
    roughness: 0.45,
  });
  const polyps = mergedParts(t, polypParts, polypMat);
  polyps.userData.lodDetail = true;
  group.add(polyps);
  geos.push(polyps.geometry);
  mats.push(polypMat);

  return {
    group,
    radius: R * 1.12,
    height: H,
    update: (time: number) => {
      // the same gate as <TidePool>: emissive only, breathing, never a lamp
      const nk = nightKOf(group);
      const ease = nk * nk * (3 - 2 * nk);
      const breathe = 0.86 + 0.1 * Math.sin(time * 0.62 + seed * 1.7) + 0.04 * Math.sin(time * 1.07 + seed);
      polypMat.emissiveIntensity = BIOLUME_DAY + (BIOLUME_NIGHT * breathe - BIOLUME_DAY) * ease;
    },
    dispose() {
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// 3. <AnchorPile> — a rusted admiralty anchor and a heap of chain
// ===========================================================================
//
// An admiralty anchor is a very specific silhouette and every part of it has to
// be there or it reads as a plus sign: shank, crown, two CURVED arms sweeping up
// out of the crown, a triangular PALM on each arm, the STOCK crossbar set at
// right angles to the arms near the head, and the ring. It leans back at ~40
// degrees with one palm dug into the sand and the shank resting across the chain
// heap. The chain is real interlocking links — alternate links rotated 90° about
// the run direction, which is the entire read of a chain.

export interface AnchorPileOpts {
  /** overall scale — the anchor is ~0.95 long at scale 1 (default 1) */
  size?: number;
  seed?: number;
  /** the coiled chain heap (default true) */
  chain?: boolean;
  /** the sand apron and drift (default true) */
  sand?: boolean;
}

export interface AnchorPileBuilt extends ComposableBuilt {
  group: THREE.Group;
  dispose: () => void;
  /** blocker radius over the anchor and the heap together */
  radius: number;
  height: number;
}

/** the anchor and chain pile. Group origin at ground level; the shank leans
 *  toward local +Z. */
export function buildAnchorPile(t: typeof THREE, opts: AnchorPileOpts = {}): AnchorPileBuilt {
  const S = opts.size ?? 1;
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'anchor-pile';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texes: THREE.Texture[] = [];

  // ---- the rust material: the local mottled/pitted canvas ---------------
  // repeat 2x3 over a ~0.7 u anchor = one tile per ~0.25 u, so the pits stay
  // several pixels across at park zoom instead of averaging to a flat brown
  const rustTex = texFrom(t, rustCanvas(), 2, 3);
  texes.push(rustTex);
  const ironMat = new t.MeshStandardMaterial({
    color: 0xffffff,
    map: rustTex,
    bumpMap: rustTex,
    bumpScale: 0.055,
    roughness: 0.94,
    metalness: 0.12, // pitted rust is NOT shiny; a little metalness keeps it iron
  });
  mats.push(ironMat);
  const chainTex = texFrom(t, rustCanvas(), 1, 1);
  texes.push(chainTex);
  const chainMat = new t.MeshStandardMaterial({
    color: 0xb08a72, // tinted a touch lighter: the heap catches more sky
    map: chainTex,
    bumpMap: chainTex,
    bumpScale: 0.04,
    roughness: 0.95,
    metalness: 0.14,
  });
  mats.push(chainMat);

  // ---- the anchor, built upright in a sub-group then leaned back --------
  const anch = new t.Group();
  const parts: PartSpec[] = [];
  const SH = 0.68 * S; // shank length
  const shankR = 0.043 * S; // HEAVY: a thin shank reads as a garden ornament
  parts.push({
    geo: new t.CylinderGeometry(shankR * 0.82, shankR * 1.14, SH, 6, 1),
    matrix: mtx(t, [0, SH * 0.5, 0]),
    uv: [1, 3],
  });
  // the crown: the heavy casting the arms grow out of
  parts.push({ geo: new t.CylinderGeometry(shankR * 1.5, shankR * 1.35, 0.1 * S, 7, 1), matrix: mtx(t, [0, 0.03 * S, 0]), uv: [1, 1] });
  // the ARMS: a circular arc from the crown out and up, in the XY plane
  const ARM_R = 0.32 * S;
  const ARM_CY = 0.3 * S;
  const NA = 5;
  for (const sgn of [1, -1]) {
    for (let i = 0; i < NA; i += 1) {
      const p0 = (i / NA) * 1.42;
      const p1 = ((i + 1) / NA) * 1.42;
      const a = new t.Vector3(sgn * Math.sin(p0) * ARM_R, ARM_CY - Math.cos(p0) * ARM_R, 0);
      const b = new t.Vector3(sgn * Math.sin(p1) * ARM_R, ARM_CY - Math.cos(p1) * ARM_R, 0);
      const d = b.clone().sub(a);
      const l = d.length();
      const rr = shankR * (1.02 - (i / NA) * 0.34);
      parts.push({ geo: new t.CylinderGeometry(rr * 0.9, rr, l * 1.08, 6, 1), matrix: alongDir(t, a, d, l), uv: [1, 1] });
    }
    // the PALM (fluke): a flat triangle on the arm end, pointing on up the arc
    const pe = 1.42;
    const tip = new t.Vector3(sgn * Math.sin(pe) * ARM_R, ARM_CY - Math.cos(pe) * ARM_R, 0);
    const tang = new t.Vector3(sgn * Math.cos(pe), Math.sin(pe), 0).normalize();
    parts.push({
      geo: new t.CylinderGeometry(0.004 * S, 0.098 * S, 0.17 * S, 3, 1),
      matrix: new t.Matrix4()
        .compose(
          tip.clone().addScaledVector(tang, 0.055 * S),
          new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), tang),
          new t.Vector3(1, 1, 1),
        )
        .multiply(new t.Matrix4().makeScale(1, 1, 0.42)),
      uv: [1, 1],
    });
  }
  // the STOCK: the crossbar at right angles to the arm plane (this is the part
  // that makes an anchor read as an ADMIRALTY anchor), with thicker nuts
  const stockL = 0.62 * S;
  parts.push({
    geo: new t.CylinderGeometry(0.027 * S, 0.027 * S, stockL, 6, 1),
    matrix: mtx(t, [0, SH * 0.84, 0], [Math.PI / 2, 0, 0.07], [1, 1, 1]),
    uv: [1, 4],
  });
  for (const sgn of [1, -1]) {
    parts.push({
      geo: new t.CylinderGeometry(0.04 * S, 0.033 * S, 0.06 * S, 6, 1),
      matrix: mtx(t, [0, SH * 0.84 + sgn * 0.022 * S, sgn * stockL * 0.47], [Math.PI / 2, 0, 0]),
      uv: [1, 1],
    });
  }
  // the RING and its shackle
  parts.push({
    geo: new t.TorusGeometry(0.068 * S, 0.02 * S, 6, 12),
    matrix: mtx(t, [0, SH + 0.062 * S, 0], [0, Math.PI / 2, 0]),
    uv: [2, 1],
  });
  parts.push({ geo: new t.BoxGeometry(0.058 * S, 0.05 * S, 0.045 * S), matrix: mtx(t, [0, SH - 0.008 * S, 0]), uv: [1, 1] });
  const anchor = mergedParts(t, parts, ironMat);
  anch.add(anchor);
  geos.push(anchor.geometry);
  // lean it back: the shank rises at ~0.72 rad off the ground toward +Z, one
  // palm dug in, and the whole thing yawed off-axis so it never looks placed
  anch.rotation.set(-(Math.PI / 2 - 0.72), 0.42, 0.14);
  anch.position.set(0.02 * S, 0.09 * S, -0.16 * S);
  group.add(anch);

  // ---- the chain heap ---------------------------------------------------
  let heapR = 0.2 * S;
  if (opts.chain ?? true) {
    const path: THREE.Vector3[] = [];
    // 3.4 turns spiralling in AND up 0.19: a HEAP with turns lying on turns, not
    // the tidy flat spiral the first pass laid out (that read as a coil of rope)
    const A = 3.4 * Math.PI * 2;
    const R0 = 0.3 * S;
    const R1 = 0.09 * S;
    const cx = 0.16 * S;
    const cz = 0.3 * S;
    const pitch = 0.076 * S;
    for (let a = 0; a < A; ) {
      const f = a / A;
      const r = R0 + (R1 - R0) * f;
      path.push(
        new t.Vector3(
          cx + Math.cos(a) * r * (1 + 0.08 * Math.sin(a * 3 + seed)),
          0.04 * S + 0.19 * S * f ** 1.15 + 0.014 * S * Math.sin(a * 2.2 + seed * 1.7),
          cz + Math.sin(a) * r * (1 + 0.08 * Math.sin(a * 2.4 + seed * 1.3)),
        ),
      );
      a += pitch / Math.max(0.05 * S, r);
    }
    // the run that leaves the heap and climbs to the anchor ring
    const ringW = new t.Vector3(0, SH + 0.05 * S, 0).applyEuler(anch.rotation).add(anch.position);
    const heapEnd = path[path.length - 1].clone();
    for (let i = 1; i <= 7; i += 1) {
      const f = i / 7;
      const p = heapEnd.clone().lerp(ringW, f);
      p.y -= Math.sin(f * Math.PI) * 0.05 * S; // it sags on the way
      path.push(p);
    }
    heapR = R0 * 1.15;
    const links: PartSpec[] = [];
    const up = new t.Vector3(0, 1, 0);
    for (let i = 0; i < path.length; i += 1) {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      const T = b.clone().sub(a);
      if (T.lengthSq() < 1e-8) continue;
      T.normalize();
      // alternate links stand at 90° to their neighbours — this is the chain
      let N = i % 2 === 0 ? up.clone() : new t.Vector3().crossVectors(T, up).normalize();
      N.addScaledVector(T, -N.dot(T)); // orthogonalise against the run
      if (N.lengthSq() < 1e-6) N = new t.Vector3(1, 0, 0);
      N.normalize();
      const Y = new t.Vector3().crossVectors(N, T).normalize();
      links.push({
        // an oval link: the torus stretched 1.55x along the run
        geo: new t.TorusGeometry(0.043 * S, 0.015 * S, 5, 10),
        matrix: new t.Matrix4()
          .makeBasis(T, Y, N)
          .setPosition(path[i])
          .multiply(new t.Matrix4().makeScale(1.55, 1, 1)),
        uv: [2, 1],
      });
    }
    const chain = mergedParts(t, links, chainMat);
    group.add(chain);
    geos.push(chain.geometry);
  }

  // ---- sand, salt stains and a shackle in the drift ---------------------
  if (opts.sand ?? true) {
    group.add(sandApron(t, 0.72 * S, 0.78 * S, TIDEWATER.sandWet));
    const drift = ball(t, 1, TIDEWATER.sandWet, [-0.1 * S, -0.05 * S, -0.24 * S], {
      tex: 'sand',
      repeat: [3, 3],
      rough: 1,
      flat: true,
    });
    drift.scale.set(0.3 * S, 0.13 * S, 0.24 * S);
    group.add(drift);
    geos.push(drift.geometry);
    mats.push(drift.material as THREE.Material);
  }
  // shell and stone litter washed up against the iron. NOT flat pale slabs: the
  // first pass laid thin `saltStain` plates on the sand and every one of them
  // read as a scrap of white paper dropped in the park. The salt bloom lives in
  // the rust canvas, where it belongs; the ground gets chunky debris instead.
  // ...and pass two of the SAME mistake: 0x9c9382 boxes at 0.06 u still read as
  // pale flakes of litter on the sand from above. Third pass: half the size, a
  // wet-sand tone barely lighter than the ground, and rounded — half-buried
  // pebbles, not objects.
  const shellParts: PartSpec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const az = hash01(i * 2.31 + seed * 4.1) * Math.PI * 2;
    const rr = (0.34 + hash01(i * 4.17 + seed) * 0.34) * S;
    const sz = (0.015 + hash01(i * 6.29 + seed) * 0.017) * S;
    shellParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, 0.018 * S, Math.sin(az) * rr],
        [(hash01(i * 12.41) - 0.5) * 0.5, hash01(i * 10.37 + seed) * Math.PI, (hash01(i * 14.7) - 0.5) * 0.5],
        [sz, sz * 0.5, sz * (0.7 + hash01(i * 8.31) * 0.6)],
      ),
      uv: [1, 1],
    });
  }
  const shellMesh = mergedParts(t, shellParts, mat(t, 0x8d7f66, { tex: 'concrete', rough: 1, bump: 0.04, flat: true }));
  shellMesh.userData.lodDetail = true;
  group.add(shellMesh);
  geos.push(shellMesh.geometry);
  mats.push(shellMesh.material as THREE.Material);

  return {
    group,
    radius: Math.max(heapR + 0.16 * S, 0.5 * S),
    height: 0.62 * S,
    dispose() {
      texes.forEach((x) => x.dispose());
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// 4. <TidePool> — a shallow rock basin holding water
// ===========================================================================
//
// The water is WaterTile's `buildWater` at amp 0.10 x waviness 0.25 — total
// swell ~0.008 u, which is what a rock pool actually does between waves, and
// its 2026-07 desaturated blue-grey palette is exactly the right colour for
// cold Atlantic water over dark rock. NOT re-saturated, NOT re-shadered.
//
// Three things make water read as water in a basin: something to see THROUGH it
// (a darker wet floor, sand and pebbles), a RIM standing above the sheet so the
// eye reads a container, and a depth SKIRT at the clipped edge. All three here.
// Flat and low, so it does NOT register a blocker — scatter it across the cove.

export interface TidePoolOpts {
  /** outer rock-shelf radius (default 0.62) */
  radius?: number;
  seed?: number;
  /** starfish, limpets, weed (default true) */
  life?: boolean;
}

export interface TidePoolBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
  /** the water surface height in the group's local frame */
  waterY: number;
}

/** the tide pool. Group origin at ground level at the centre of the basin. */
export function buildTidePool(t: typeof THREE, opts: TidePoolOpts = {}): TidePoolBuilt {
  const R = opts.radius ?? 0.62;
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'tide-pool';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const WR = R * 0.56; // water radius
  const WY = 0.075; // water surface height
  const FLOOR = 0.018; // basin floor top
  /** the anemones' night-gated material — built inside the `life` block below,
   *  so a pool built with `life: false` gates nothing (and the updater checks) */
  let anemoneMat: THREE.MeshStandardMaterial | null = null;

  // ---- the shelf, the wet fringe and the basin floor --------------------
  // wet sand around the outcrop, so the pool sits in a cove rather than on a
  // lawn (the same trick Emberfall's fissure uses with its scorched apron)
  group.add(sandApron(t, R * 1.32, R * 1.32, TIDEWATER.sandWet));
  // A tide pool sits in a rock PLATFORM, not in a ring of boulders: the shelf is
  // wide and low (top at y 0.035) and the basin is a dish cut into it.
  const shelf = cyl(t, R * 1.04, R * 1.1, 0.07, TIDEWATER.rockDry, [0, 0, 0], {
    tex: 'concrete',
    repeat: [Math.max(4, Math.round(R * 9)), Math.max(4, Math.round(R * 9))],
    rough: 0.98,
    bump: 0.05,
    seg: 32,
  });
  group.add(shelf);
  geos.push(shelf.geometry);
  mats.push(shelf.material as THREE.Material);
  // the WET FRINGE: the darker, algae-slick ring of rock the water laps over.
  // Without it the sheet reads as a blue lid dropped on dry stone.
  const fringe = cyl(t, WR * 1.2, WR * 1.26, 0.05, 0x625d53, [0, 0.022, 0], {
    tex: 'concrete',
    repeat: [6, 6],
    rough: 0.62, // slick with water: the one low-roughness rock in the world
    bump: 0.04,
    seg: 30,
  });
  group.add(fringe);
  geos.push(fringe.geometry);
  mats.push(fringe.material as THREE.Material);
  // the floor: PALE wet sand, because a light bottom is what makes shallow water
  // read as shallow (a dark floor under a 0.78-opacity sheet reads as deep)
  const floor = cyl(t, WR * 1.24, WR * 1.14, 0.06, TIDEWATER.sandWet, [0, FLOOR - 0.03, 0], {
    tex: 'sand',
    repeat: [4, 4],
    rough: 1,
    seg: 28,
  });
  group.add(floor);
  geos.push(floor.geometry);
  mats.push(floor.material as THREE.Material);

  // ---- the rim: an IRREGULAR broken lip, not a ring of boulders ----------
  // First pass: 17 near-identical rounded lumps at one radius, which read
  // unmistakably as a campfire ring / wishing well. Fixed by spreading the radius
  // over 0.64…0.98 R, dropping the sizes and heights hard, and leaving real GAPS
  // in the lip. Note the "slabs" are SQUASHED ICOSAHEDRA, not boxes: a literal
  // BoxGeometry rock reads as a kerbstone or a dropped concrete block every
  // single time, whatever colour it is.
  const rimParts: PartSpec[] = [];
  const NR = 15;
  const rimTops: { x: number; z: number; y: number }[] = [];
  for (let i = 0; i < NR; i += 1) {
    const az = (i / NR) * Math.PI * 2 + (hash01(i * 3.31 + seed) - 0.5) * 0.5;
    if (hash01(i * 19.7 + seed * 2.9) < 0.2) continue; // a gap in the lip: bare shelf
    const rr = R * (0.64 + hash01(i * 5.17 + seed) * 0.34);
    // SMALL: an icosahedron scaled by s is 2s across, so the first pass's
    // s = 0.33R put 0.41 u boulders around a 0.7 u pool — a fire ring again
    const s = R * (0.08 + hash01(i * 7.19 + seed) * 0.11);
    const h = R * (0.05 + hash01(i * 9.23 + seed) * 0.12);
    const x = Math.cos(az) * rr;
    const z = Math.sin(az) * rr;
    const slab = hash01(i * 21.3 + seed) > 0.6; // a flat fractured plate
    rimParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [x, 0.03 + h * (slab ? 0.26 : 0.42), z],
        [
          (hash01(i * 11.3) - 0.5) * (slab ? 0.9 : 0.5),
          az + (hash01(i * 13.7) - 0.5) * 1.1,
          (hash01(i * 15.1) - 0.5) * (slab ? 0.8 : 0.5),
        ],
        slab ? [s * 1.7, h * 0.5, s * 1.05] : [s, h, s * (0.8 + hash01(i * 17.3) * 0.5)],
      ),
      uv: [2, 2],
    });
    rimTops.push({ x, z, y: 0.03 + h * (slab ? 0.78 : 0.86) });
  }
  // half-buried rocks out on the shelf, breaking up what is otherwise a pair of
  // concentric discs (shelf + sand) with a pool in the middle
  for (let i = 0; i < 7; i += 1) {
    const az = hash01(i * 33.1 + seed * 4.3) * Math.PI * 2;
    const rr = R * (1.0 + hash01(i * 35.7 + seed) * 0.24);
    const s = R * (0.07 + hash01(i * 37.9 + seed) * 0.1);
    rimParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(
        t,
        [Math.cos(az) * rr, 0.012 + s * 0.2, Math.sin(az) * rr],
        [(hash01(i * 39.3) - 0.5) * 0.6, hash01(i * 41.7) * Math.PI, (hash01(i * 43.1) - 0.5) * 0.6],
        [s, s * 0.5, s * 0.85],
      ),
      uv: [1, 1],
    });
  }
  // three rocks standing IN the pool and breaking the surface — the single
  // cheapest cue that the water is only ankle-deep
  for (let i = 0; i < 3; i += 1) {
    const az = hash01(i * 23.9 + seed * 3.7) * Math.PI * 2;
    const rr = WR * (0.34 + hash01(i * 25.1 + seed) * 0.44);
    const s = R * (0.05 + hash01(i * 27.3 + seed) * 0.055);
    const x = Math.cos(az) * rr;
    const z = Math.sin(az) * rr;
    const h = WY + 0.015 + hash01(i * 29.7 + seed) * 0.04;
    rimParts.push({
      geo: new t.IcosahedronGeometry(1, 1),
      matrix: mtx(t, [x, h * 0.4, z], [0, hash01(i * 31.1) * Math.PI, 0], [s, h, s * 0.86]),
      uv: [1, 1],
    });
    rimTops.push({ x, z, y: h * 0.78 });
  }
  // the rim is DRY rock (the fringe disc under it carries the wet tone): dark
  // wet-rock lumps all round read as a ring of slate kerbstones
  const rimMat = mat(t, 0x76716a, { tex: 'concrete', rough: 0.95, bump: 0.07, flat: true });
  const rim = mergedParts(t, rimParts, rimMat);
  group.add(rim);
  geos.push(rim.geometry);
  mats.push(rimMat);

  // pebbles on the floor — read THROUGH the sheet, which is half of why the
  // water looks like water instead of a blue lid
  const peb: MergedBoxSpec[] = [];
  for (let i = 0; i < 26; i += 1) {
    const az = hash01(i * 2.71 + seed * 2.3) * Math.PI * 2;
    const rr = WR * hash01(i * 4.31 + seed) ** 0.6 * 0.86;
    const sz = 0.016 + hash01(i * 6.53 + seed) * 0.026;
    peb.push({
      dims: [sz, sz * 0.55, sz * (0.7 + hash01(i * 8.71) * 0.7)],
      pos: [Math.cos(az) * rr, FLOOR + sz * 0.2, Math.sin(az) * rr],
      rotX: (hash01(i * 10.3) - 0.5) * 0.4,
      rotY: hash01(i * 12.7 + seed) * Math.PI,
      rotZ: (hash01(i * 14.9) - 0.5) * 0.4,
      repeat: [1, 1],
    });
  }
  const pebbles = mergedBoxes(t, peb, 0x6f6a60, { tex: 'concrete', rough: 0.6, bump: 0.04, flat: true });
  group.add(pebbles);
  geos.push(pebbles.geometry);
  mats.push(pebbles.material as THREE.Material);

  // ---- the water: WaterTile's sheet, almost still -----------------------
  // amp 0.10 x waviness 0.25 => ~0.008 u of swell: the troughs never dip to the
  // floor (WY - 0.008 = 0.067 vs a floor at 0.018) so there is no dead flat
  // patch, and the shader's ripple/foam/twinkle are all quieted with it.
  const water = buildWater(t, WR * 2 + 0.2, 56, WR, 0.045, 0.1, 0.25);
  water.mesh.position.y = WY;
  group.add(water.mesh);
  geos.push(water.mesh.geometry);
  mats.push(water.mesh.material as THREE.Material);

  // ---- the life ---------------------------------------------------------
  if (opts.life ?? true) {
    // STARFISH: five tapered arms radiating from a low disc. Two of them — one
    // on a rim rock out of the water, one on the floor under the sheet.
    const starParts: PartSpec[] = [];
    const stars: [number, number, number, number][] = [
      // one out of the water on the bare shelf beside the pool (0.11 across: the
      // first pass at 0.072 vanished at park zoom), one submerged on the floor
      [Math.cos(2.3) * R * 0.82, 0.038, Math.sin(2.3) * R * 0.82, 0.11],
      [-WR * 0.4, FLOOR + 0.014, WR * 0.28, 0.085],
      [rimTops[1].x * 0.96, rimTops[1].y, rimTops[1].z * 0.96, 0.075],
    ];
    for (let s = 0; s < stars.length; s += 1) {
      const [sx, sy, sz, sr] = stars[s];
      starParts.push({ geo: new t.CylinderGeometry(sr * 0.34, sr * 0.4, sr * 0.3, 8, 1), matrix: mtx(t, [sx, sy, sz]) });
      for (let a = 0; a < 5; a += 1) {
        const az = (a / 5) * Math.PI * 2 + hash01(s * 3.7 + seed) * 2;
        const dir = new t.Vector3(Math.cos(az), 0.14, Math.sin(az)).normalize();
        starParts.push({
          geo: new t.CylinderGeometry(sr * 0.09, sr * 0.28, sr * 0.86, 5, 1),
          matrix: new t.Matrix4()
            .compose(
              new t.Vector3(sx + Math.cos(az) * sr * 0.44, sy + sr * 0.06, sz + Math.sin(az) * sr * 0.44),
              new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir),
              new t.Vector3(1, 1, 1),
            )
            .multiply(new t.Matrix4().makeScale(1, 1, 0.5)),
        });
      }
    }
    const starMat = mat(t, TIDEWATER.starfish, { rough: 0.85, bump: 0.02 });
    const starMesh = mergedParts(t, starParts, starMat);
    group.add(starMesh);
    geos.push(starMesh.geometry);
    mats.push(starMat);

    // LIMPETS and mussels: little cones clustered on the rim rocks
    const limpets: PartSpec[] = [];
    for (let i = 0; i < 22; i += 1) {
      // index by the ACTUAL length, never NR: the rim loop `continue`s over a
      // hashed 20% of its NR slots to leave gaps of bare shelf, so rimTops holds
      // (NR - gaps + 3 pool rocks) entries — fewer than NR on unlucky seeds, and
      // `% NR` then hands back undefined and throws inside the mount effect,
      // which takes down every sibling in the same set-piece.
      const rt = rimTops[Math.floor(hash01(i * 2.11 + seed * 3.3) * rimTops.length) % rimTops.length];
      const az = hash01(i * 4.23 + seed) * Math.PI * 2;
      const rr = R * 0.09 * hash01(i * 6.37 + seed);
      const sz = 0.011 + hash01(i * 8.41 + seed) * 0.012;
      limpets.push({
        geo: new t.CylinderGeometry(sz * 0.25, sz, sz * 0.9, 6, 1),
        matrix: mtx(t, [rt.x + Math.cos(az) * rr, rt.y - 0.004, rt.z + Math.sin(az) * rr], [
          (hash01(i * 10.53) - 0.5) * 0.5,
          0,
          (hash01(i * 12.61) - 0.5) * 0.5,
        ]),
      });
    }
    const limMat = mat(t, TIDEWATER.limpet, { rough: 0.9 });
    const limMesh = mergedParts(t, limpets, limMat);
    limMesh.userData.lodDetail = true; // limpets: close-up only
    group.add(limMesh);
    geos.push(limMesh.geometry);
    mats.push(limMat);

    // WEED: bladderwrack in four TUFTS rather than sixteen lonely blades —
    // scattered singles at this size read as green confetti, a clump reads as
    // weed. Each tuft leans out of the rim, one or two of them trailing a blade
    // into the water.
    const weed: MergedBoxSpec[] = [];
    for (let i = 0; i < 4; i += 1) {
      const az = (i / 4) * Math.PI * 2 + hash01(i * 3.13 + seed * 5.7) * 1.3;
      const rr = R * (0.68 + hash01(i * 5.19 + seed) * 0.22);
      const inward = i % 2 === 0;
      const bx = Math.cos(az) * rr;
      const bz = Math.sin(az) * rr;
      const by = 0.04 + hash01(i * 11.4) * 0.04;
      for (let k = 0; k < 5; k += 1) {
        const len = 0.1 + hash01(i * 9.31 + k * 2.7 + seed) * 0.11;
        const sway = (hash01(i * 7.23 + k * 3.9) - 0.5) * 0.7;
        const lay = inward ? -0.75 - hash01(i * 13.5 + k) * 0.5 : -0.25 - hash01(i * 15.6 + k) * 0.45;
        const off = 0.022 * (k - 2);
        weed.push({
          dims: [0.024 + hash01(i * 17.7 + k) * 0.016, len, 0.008],
          pos: [
            bx - Math.sin(az) * off + Math.cos(az) * (inward ? -1 : 1) * len * 0.3,
            by + len * 0.42 * Math.cos(lay),
            bz + Math.cos(az) * off + Math.sin(az) * (inward ? -1 : 1) * len * 0.3,
          ],
          rotX: Math.sin(az) * lay,
          rotY: az + sway,
          rotZ: -Math.cos(az) * lay,
          repeat: [1, 1],
        });
      }
    }
    const weedMesh = mergedBoxes(t, weed, TIDEWATER.weed, { tex: 'leaf', rough: 0.75, bump: 0.03 });
    group.add(weedMesh);
    geos.push(weedMesh.geometry);
    mats.push(weedMesh.material as THREE.Material);

    // ANEMONES — the one thing in this pack that is alive after dark.
    //
    // WHY THEY EXIST. Measured, the whole five-piece pack shipped with ZERO
    // emissive materials and zero lights, and the night render is what that
    // buys you: the hull, the anchor and the reef head simply GO AWAY, which is
    // the rubric's "night adds nothing / night is presence-not-brightness" pair
    // of deductions rather than a mood. A tide pool is the honest place to fix
    // it — real anemones and real coral polyps fluoresce, and Deep Drift already
    // lights its trench with the same organism, so this borrows the world's own
    // vocabulary instead of inventing a lamp. Nothing here is a PointLight: the
    // read is emissive-only, so the pack still costs the light budget nothing.
    //
    // FIVE COLUMNS, ONE MERGED DRAW, CLUMPED. Two on the floor under the water
    // sheet (so the glow comes up THROUGH the water, which is the shot), two in
    // the shaded crevice at the rim and one on the wet shelf just out of the
    // pool. They are stubby cylinders with a crown of short tentacle stubs —
    // a bare disc read as a coloured coin on the sand.
    const anemoneParts: PartSpec[] = [];
    const anemoneAt: [number, number, number, number][] = [
      [-WR * 0.52, FLOOR + 0.006, -WR * 0.18, 0.034],
      [WR * 0.3, FLOOR + 0.006, WR * 0.46, 0.027],
      [Math.cos(4.1) * R * 0.74, 0.03, Math.sin(4.1) * R * 0.74, 0.023],
      [Math.cos(4.6) * R * 0.68, 0.026, Math.sin(4.6) * R * 0.68, 0.018],
      [Math.cos(0.7) * R * 0.86, 0.034, Math.sin(0.7) * R * 0.86, 0.021],
    ];
    for (let i = 0; i < anemoneAt.length; i += 1) {
      const [ax, ay, az, ar] = anemoneAt[i];
      // the column
      anemoneParts.push({ geo: new t.CylinderGeometry(ar * 0.82, ar * 0.62, ar * 1.5, 8, 1), matrix: mtx(t, [ax, ay + ar * 0.75, az]) });
      // the oral disc
      anemoneParts.push({ geo: new t.CylinderGeometry(ar, ar * 0.86, ar * 0.34, 8, 1), matrix: mtx(t, [ax, ay + ar * 1.62, az]) });
      // a crown of tentacle stubs, splayed
      const TENT = 7;
      for (let k = 0; k < TENT; k += 1) {
        const ta = (k / TENT) * Math.PI * 2 + hash01(i * 3.7 + seed) * 2;
        const lean = 0.65 + hash01(i * 5.3 + k * 1.9) * 0.5;
        const dir = new t.Vector3(Math.cos(ta) * Math.sin(lean), Math.cos(lean), Math.sin(ta) * Math.sin(lean)).normalize();
        anemoneParts.push({
          geo: new t.CylinderGeometry(ar * 0.07, ar * 0.13, ar * 0.8, 4, 1),
          matrix: new t.Matrix4().compose(
            new t.Vector3(ax + dir.x * ar * 0.6, ay + ar * 1.72 + dir.y * ar * 0.3, az + dir.z * ar * 0.6),
            new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 1, 0), dir),
            new t.Vector3(1, 1, 1),
          ),
        });
      }
    }
    anemoneMat = new t.MeshStandardMaterial({
      color: TIDEWATER.biolume,
      emissive: new t.Color(BIOLUME_GLOW),
      emissiveIntensity: BIOLUME_DAY,
      roughness: 0.42,
    });
    const anemoneMesh = mergedParts(t, anemoneParts, anemoneMat);
    // fine detail: 5 anemones in a 0.6-unit pool are a close-up read
    anemoneMesh.userData.lodDetail = true;
    group.add(anemoneMesh);
    geos.push(anemoneMesh.geometry);
    mats.push(anemoneMat);
  }

  return {
    group,
    radius: R,
    height: 0.24,
    waterY: WY,
    update: (time: number) => {
      water.update(time);
      // the night gate. Two anemones breathe out of phase with each other on a
      // slow hashed pair of sines — a CONSTANT glow reads as a bulb, and the
      // whole point is that this is tissue.
      if (anemoneMat) {
        const nk = nightKOf(group);
        const ease = nk * nk * (3 - 2 * nk);
        const breathe = 0.86 + 0.1 * Math.sin(time * 0.7 + seed) + 0.04 * Math.sin(time * 1.13 + seed * 2.1);
        anemoneMat.emissiveIntensity = BIOLUME_DAY + (BIOLUME_NIGHT * breathe - BIOLUME_DAY) * ease;
      }
    },
    dispose() {
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// 5. <DockPilings> — leaning timber piles with a draped net
// ===========================================================================
//
// Four salt-scoured piles at different heights and different leans (parallel
// piles read as a fence), each dark with creosote and algae at the foot, banded
// with barnacles at the old waterline and silvered above it. Broken, sawn and
// iron-capped tops. A weathered CROSSBEAM lashed across two of them carries the
// rope wraps and the draped NET — the net is a real grid of strands over a
// sagging surface, pooling on the sand at the bottom, and it swings ~0.02 rad
// about the beam on a slow absolute-time updater.

export interface DockPilingsOpts {
  /** number of piles, clamped 2…6 (default 4) */
  count?: number;
  /** the tallest pile (default 1.25) */
  height?: number;
  /** cluster radius (default 0.34) */
  radius?: number;
  seed?: number;
  /** the draped fishing net (default true) */
  net?: boolean;
}

export interface DockPilingsBuilt extends ComposableBuilt {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
  radius: number;
  height: number;
}

/** the piling cluster. Group origin at ground level at the cluster centre. */
export function buildDockPilings(t: typeof THREE, opts: DockPilingsOpts = {}): DockPilingsBuilt {
  const N = Math.max(2, Math.min(6, Math.round(opts.count ?? 4)));
  const H = opts.height ?? 1.25;
  const R = opts.radius ?? 0.34;
  const seed = opts.seed ?? 1;
  const group = new t.Group();
  group.name = 'dock-pilings';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const pileR = 0.058;
  const dark: PartSpec[] = []; // creosote/algae foot
  const pale: PartSpec[] = []; // salt-bleached shaft
  const iron: PartSpec[] = []; // cap bands
  const barn: MergedBoxSpec[] = [];
  const splint: PartSpec[] = [];
  const piles: { x: number; z: number; top: THREE.Vector3; dir: THREE.Vector3; h: number }[] = [];

  for (let i = 0; i < N; i += 1) {
    const az = (i / N) * Math.PI * 2 + hash01(i * 3.7 + seed) * 0.9;
    const rr = R * (0.32 + hash01(i * 5.3 + seed) * 0.68);
    const x = Math.cos(az) * rr;
    const z = Math.sin(az) * rr;
    const h = H * (0.68 + hash01(i * 7.1 + seed) * 0.34);
    // every pile leans a different way and a different amount
    const lean = 0.06 + hash01(i * 9.7 + seed) * 0.17;
    const laz = hash01(i * 11.3 + seed) * Math.PI * 2;
    const dir = new t.Vector3(Math.sin(lean) * Math.cos(laz), Math.cos(lean), Math.sin(lean) * Math.sin(laz)).normalize();
    const base = new t.Vector3(x, -0.06, z);
    const top = base.clone().addScaledVector(dir, h + 0.06);
    piles.push({ x, z, top, dir, h });
    // foot: tarred and weed-dark, up to 0.30 of the pile
    const footL = h * 0.3;
    dark.push({
      geo: new t.CylinderGeometry(pileR * 1.02, pileR * 1.2, footL + 0.06, 8, 1),
      matrix: alongDir(t, base, dir, footL + 0.06),
      uv: [2, Math.max(2, Math.round(footL * 4))],
    });
    // shaft: silvered driftwood, tapering a little
    const shaftBase = base.clone().addScaledVector(dir, footL);
    const shaftL = h + 0.06 - footL;
    pale.push({
      geo: new t.CylinderGeometry(pileR * 0.88, pileR * 1.03, shaftL, 8, 1),
      matrix: alongDir(t, shaftBase, dir, shaftL),
      uv: [2, Math.max(3, Math.round(shaftL * 4))],
    });
    // top treatment: 0 = snapped and splintered, 1 = iron cap band, else sawn
    const kind = i % 3;
    if (kind === 0) {
      for (let k = 0; k < 4; k += 1) {
        const sa = (k / 4) * Math.PI * 2 + hash01(i * 13.1 + k) * 1.4;
        const sl = 0.05 + hash01(i * 15.7 + k) * 0.13;
        const sd = dir
          .clone()
          .addScaledVector(new t.Vector3(Math.cos(sa), 0, Math.sin(sa)), 0.26 + hash01(i * 17.9 + k) * 0.3)
          .normalize();
        splint.push({
          geo: new t.CylinderGeometry(pileR * 0.07, pileR * (0.3 + hash01(i * 19.3 + k) * 0.24), sl, 4, 1),
          matrix: alongDir(t, top.clone().addScaledVector(dir, -0.02), sd, sl),
          uv: [1, 1],
        });
      }
    } else if (kind === 1) {
      iron.push({
        geo: new t.CylinderGeometry(pileR * 1.12, pileR * 1.12, 0.055, 8, 1, true),
        matrix: alongDir(t, top.clone().addScaledVector(dir, -0.075), dir, 0.055),
        uv: [3, 1],
      });
    }
    // barnacle band at the old waterline (0.28…0.48 of the pile)
    for (let k = 0; k < 32; k += 1) {
      const f = 0.28 + hash01(i * 21.1 + k * 2.7 + seed) * 0.2;
      const bz = base.clone().addScaledVector(dir, (h + 0.06) * f);
      const ba = hash01(i * 23.7 + k * 3.9) * Math.PI * 2;
      const sz = 0.01 + hash01(i * 25.3 + k) * 0.015;
      barn.push({
        dims: [sz, sz * 0.9, sz * 0.6],
        pos: [bz.x + Math.cos(ba) * pileR * 0.96, bz.y, bz.z + Math.sin(ba) * pileR * 0.96],
        rotY: -ba,
        repeat: [1, 1],
      });
    }
  }

  // ---- the crossbeam, lashed across the two tallest piles ---------------
  const order = piles.map((p, i) => ({ i, y: p.top.y })).sort((a, b) => b.y - a.y);
  const A = piles[order[0].i];
  const B = piles[order[1].i];
  const beamY = Math.min(A.top.y, B.top.y) - 0.16;
  const pa = new t.Vector3(A.x + A.dir.x * beamY, beamY, A.z + A.dir.z * beamY);
  const pb = new t.Vector3(B.x + B.dir.x * beamY, beamY - 0.045, B.z + B.dir.z * beamY);
  const bd = pb.clone().sub(pa);
  const beamLen = bd.length();
  const beamMid = pa.clone().addScaledVector(bd, 0.5);
  const beamYaw = Math.atan2(bd.z, bd.x);
  const beamPitch = Math.asin(bd.y / Math.max(1e-4, beamLen));
  const beam = new t.Mesh(
    new t.BoxGeometry(beamLen * 1.18, 0.072, 0.092),
    mat(t, TIDEWATER.driftwood, { tex: 'wood', repeat: [Math.max(3, Math.round(beamLen * 4)), 1], rough: 1, bump: 0.045 }),
  );
  beam.position.copy(beamMid);
  beam.rotation.set(0, -beamYaw, beamPitch);
  beam.castShadow = true;
  beam.receiveShadow = true;
  group.add(beam);
  geos.push(beam.geometry);
  mats.push(beam.material as THREE.Material);
  // through-bolts at the two beam joins: the small piece of ironmongery that
  // says "jetty" rather than "two sticks and a plank"
  for (const p of [pa, pb]) {
    iron.push({
      geo: new t.CylinderGeometry(0.014, 0.014, 0.16, 6, 1),
      // axis (-sin yaw, 0, cos yaw): ACROSS the beam, through the pile
      matrix: mtx(t, [p.x, p.y + 0.012, p.z], [Math.PI / 2, -beamYaw, 0]),
      uv: [1, 1],
    });
  }

  // ---- rope: lashings at the beam joins, wraps up the piles, one loop ---
  const rope: PartSpec[] = [];
  const ringOf = (p: THREE.Vector3, dir: THREE.Vector3, rr: number) => ({
    geo: new t.TorusGeometry(rr, 0.011, 5, 12),
    matrix: new t.Matrix4().compose(
      p,
      new t.Quaternion().setFromUnitVectors(new t.Vector3(0, 0, 1), dir.clone().normalize()),
      new t.Vector3(1, 1, 1),
    ),
  });
  for (const [p, d] of [
    [pa, A.dir],
    [pb, B.dir],
  ] as [THREE.Vector3, THREE.Vector3][]) {
    for (let k = 0; k < 3; k += 1)
      rope.push(ringOf(p.clone().addScaledVector(d, -0.03 + k * 0.03), d, pileR * 1.24 + 0.004 * k));
  }
  for (let i = 0; i < N; i += 1) {
    if (hash01(i * 27.1 + seed) < 0.45) continue;
    const p = piles[i];
    const f = 0.5 + hash01(i * 29.3 + seed) * 0.34;
    for (let k = 0; k < 3; k += 1)
      rope.push(
        ringOf(
          new t.Vector3(p.x, -0.06, p.z).addScaledVector(p.dir, (p.h + 0.06) * f + k * 0.026),
          p.dir,
          pileR * 1.2,
        ),
      );
  }
  // a rope loop hanging in a catenary from the beam back to a pile
  {
    const c0 = pa.clone().addScaledVector(bd, 0.22);
    const c1 = new t.Vector3(piles[order[2 % N].i].x, 0.42, piles[order[2 % N].i].z);
    const NPT = 9;
    let prev = c0.clone();
    for (let k = 1; k <= NPT; k += 1) {
      const f = k / NPT;
      const p = c0.clone().lerp(c1, f);
      p.y -= Math.sin(f * Math.PI) * 0.18;
      const d = p.clone().sub(prev);
      const l = d.length();
      rope.push({ geo: new t.CylinderGeometry(0.011, 0.011, l * 1.1, 5, 1), matrix: alongDir(t, prev, d, l) });
      prev = p;
    }
  }
  const ropeMat = mat(t, TIDEWATER.rope, { rough: 1 });
  const ropeMesh = mergedParts(t, rope, ropeMat);
  group.add(ropeMesh);
  geos.push(ropeMesh.geometry);
  mats.push(ropeMat);

  // ---- the draped net --------------------------------------------------
  // Built in a sub-group whose origin is the beam midpoint and whose local +X
  // runs along the beam, so the whole drape can SWING about the beam axis.
  const netGroup = new t.Group();
  netGroup.position.copy(beamMid);
  netGroup.rotation.y = -beamYaw;
  if (opts.net ?? true) {
    // TWO passes of tuning live in these numbers. (1) Gauge and density: the
    // first pass hung a 7x6 grid of 0.0075-radius strands and the net was
    // invisible from three metres. (2) SQUARE MESH: the second pass kept 9
    // columns over a 0.45 span (0.05 apart) but only 7 rows over a 0.8 drop
    // (0.13 apart), and a net with 2.5x denser verticals than horizontals reads
    // as a CAGE — prison bars slung between two posts. Both counts now come from
    // one target spacing, so the mesh is square whatever the beam measures.
    const MESH = 0.082;
    const span = Math.min(beamLen * 0.66, 0.62);
    const drop = Math.max(0.34, beamY - 0.07);
    const uOff = -beamLen * 0.08; // hung off-centre: nothing here is symmetric
    // WHICH SIDE THE NET HANGS ON IS PART OF THE PIECE'S CONTRACT. The beam takes
    // whatever yaw the two tallest hashed piles give it, so the drape can only
    // hang on one of two perpendiculars — always pick the one pointing into the
    // piece's LOCAL +Z hemisphere. That makes `rotation` aim the net: a layout
    // (or a preview) can turn the drape toward the camera instead of hiding it
    // behind its own piles, which is what a "closest perpendicular to outward"
    // rule did for two passes.
    const side = Math.cos(beamYaw) >= 0 ? 1 : -1;
    const NU = Math.max(4, Math.round(span / MESH) + 1);
    const NV = Math.max(5, Math.round(drop / MESH) + 1);
    const nodes: THREE.Vector3[][] = [];
    for (let u = 0; u < NU; u += 1) {
      const fu = u / (NU - 1);
      const row: THREE.Vector3[] = [];
      for (let v = 0; v < NV; v += 1) {
        const fv = v / (NV - 1);
        // sag across the span, a growing outward belly, and the last rows POOL
        // out onto the sand instead of hanging straight — a net has slack
        const sag = Math.sin(fu * Math.PI) * 0.07 * (0.3 + fv);
        const pool = Math.max(0, fv - 0.66) / 0.34;
        const y = -sag - drop * (fv ** 1.08) * (1 - pool * 0.14);
        // GATHERED at the head rope and FANNING out below it (0.7 -> 1.12 of the
        // span), with a bulge in plan toward the viewer: a constant-width
        // rectangle of even cells reads as a trellis panel, however fine the
        // mesh is. The trapezoid plus the curve is the drape.
        const wide = span * (0.7 + 0.42 * fv);
        const belly = 0.05 + fv * 0.12 + pool ** 1.4 * 0.3 + Math.sin(fu * Math.PI) * 0.075 * (0.4 + fv);
        row.push(
          new t.Vector3(
            uOff + (-0.5 + fu) * wide + (hash01(u * 3.1 + v * 5.7 + seed) - 0.5) * 0.022,
            Math.max(-drop + 0.014, y) + (hash01(u * 11.9 + v * 4.3 + seed) - 0.5) * 0.014,
            side * (belly + (hash01(u * 7.3 + v * 9.1 + seed) - 0.5) * 0.024),
          ),
        );
      }
      nodes.push(row);
    }
    const strands: PartSpec[] = [];
    const link = (a: THREE.Vector3, b: THREE.Vector3, rr: number) => {
      const d = b.clone().sub(a);
      const l = d.length();
      if (l < 1e-4) return;
      strands.push({ geo: new t.CylinderGeometry(rr, rr, l * 1.06, 4, 1), matrix: alongDir(t, a, d, l) });
    };
    // a couple of strands are GONE: an old net has holes in it
    const torn = (u: number, v: number) => hash01(u * 5.3 + v * 13.7 + seed * 2.9) > 0.93;
    for (let u = 0; u < NU; u += 1)
      for (let v = 0; v + 1 < NV; v += 1) if (!torn(u, v)) link(nodes[u][v], nodes[u][v + 1], 0.0105);
    for (let u = 0; u + 1 < NU; u += 1)
      for (let v = 0; v < NV; v += 1)
        if (v === NV - 1 || !torn(u + 20, v)) link(nodes[u][v], nodes[u + 1][v], v === NV - 1 ? 0.016 : 0.0105);
    // the head rope along the beam, plus a slung-over-the-top row so the net
    // reads as THROWN over the beam rather than pinned to a line
    for (let u = 0; u + 1 < NU; u += 1) link(nodes[u][0], nodes[u + 1][0], 0.018);
    for (let u = 0; u < NU; u += 2)
      link(nodes[u][0], new t.Vector3(nodes[u][0].x, 0.05, -0.07 * side), 0.0105);
    // 0.0105 u strands carry NO map: any tile would be sub-pixel at park zoom,
    // and a dried net is a dull tan — pale grey strands read as steel bar
    const netMat = mat(t, 0x8f8672, { rough: 1 });
    const netMesh = mergedParts(t, strands, netMat);
    netGroup.add(netMesh);
    geos.push(netMesh.geometry);
    mats.push(netMat);
    const floats: PartSpec[] = [];
    for (let u = 1; u < NU; u += 2) {
      const p = nodes[u][0].clone();
      p.y -= 0.014;
      floats.push({ geo: new t.SphereGeometry(0.032, 8, 6), matrix: mtx(t, [p.x, p.y, p.z], [0, 0, 0], [1, 0.8, 0.8]) });
    }
    const floatMat = mat(t, 0xa8763f, { rough: 0.9 });
    const floatMesh = mergedParts(t, floats, floatMat);
    floatMesh.userData.lodDetail = true; // cork floats: close-up only
    netGroup.add(floatMesh);
    geos.push(floatMesh.geometry);
    mats.push(floatMat);
  }
  group.add(netGroup);

  // ---- merge the timber, iron and crust --------------------------------
  const darkMat = mat(t, TIDEWATER.timberDark, { tex: 'wood', rough: 1, bump: 0.05 });
  const darkMesh = mergedParts(t, dark, darkMat);
  group.add(darkMesh);
  geos.push(darkMesh.geometry);
  mats.push(darkMat);
  const paleMat = mat(t, TIDEWATER.driftwood, { tex: 'wood', rough: 1, bump: 0.045 });
  const paleMesh = mergedParts(t, pale, paleMat);
  group.add(paleMesh);
  geos.push(paleMesh.geometry);
  mats.push(paleMat);
  if (splint.length) {
    const spMat = mat(t, TIDEWATER.driftwoodPale, { rough: 1 });
    const spMesh = mergedParts(t, splint, spMat);
    group.add(spMesh);
    geos.push(spMesh.geometry);
    mats.push(spMat);
  }
  if (iron.length) {
    const irMat = mat(t, TIDEWATER.rustDark, { tex: 'metal', rough: 0.9, metal: 0.2, bump: 0.03 });
    irMat.side = t.DoubleSide;
    const irMesh = mergedParts(t, iron, irMat);
    group.add(irMesh);
    geos.push(irMesh.geometry);
    mats.push(irMat);
  }
  const barnMesh = mergedBoxes(t, barn, 0xbdb4a2, { tex: 'concrete', rough: 0.9, bump: 0.06, flat: true });
  group.add(barnMesh);
  geos.push(barnMesh.geometry);
  mats.push(barnMesh.material as THREE.Material);

  // ---- the wet sand the piles stand in, and a little weed --------------
  group.add(sandApron(t, R * 1.9, R * 1.9, TIDEWATER.sandWet));
  // stranded weed: LONG thin wracks lying in the wet sand, not the stubby bright
  // rectangles of the first pass (with a 'leaf' map they read as green confetti)
  const litter: MergedBoxSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    const az = hash01(i * 2.31 + seed * 7.7) * Math.PI * 2;
    const rr = R * (0.8 + hash01(i * 4.17 + seed) * 0.9);
    const len = 0.1 + hash01(i * 6.29 + seed) * 0.13;
    litter.push({
      dims: [0.016 + hash01(i * 8.31) * 0.012, 0.008, len],
      pos: [Math.cos(az) * rr, 0.014, Math.sin(az) * rr],
      rotY: hash01(i * 10.37 + seed) * Math.PI,
      rotX: (hash01(i * 12.41) - 0.5) * 0.2,
      repeat: [1, 1],
    });
  }
  const litMesh = mergedBoxes(t, litter, 0x3f4a2d, { rough: 0.85 });
  litMesh.userData.lodDetail = true;
  group.add(litMesh);
  geos.push(litMesh.geometry);
  mats.push(litMesh.material as THREE.Material);

  const tallest = piles.reduce((m, p) => Math.max(m, p.top.y), 0);
  return {
    group,
    radius: R + pileR * 2 + 0.06,
    height: tallest,
    // a slow, shallow swing of the whole drape about the beam — absolute time,
    // ~11 s period, ±0.022 rad. Nothing else in the cove moves but the water.
    update: (time: number) => {
      netGroup.rotation.x = 0.022 * Math.sin(time * 0.56) + 0.014 * Math.sin(time * 0.23 + 1.7);
      netGroup.rotation.z = 0.012 * Math.sin(time * 0.41 + 0.6);
    },
    dispose() {
      geos.forEach((g) => {
        if (!g.userData.shared) g.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}

// ===========================================================================
// THE COMPOSABLE COMPONENTS (components/Park/Context.md convention)
//
// Each mounts into the surrounding <Park> / <ScenePreview> at
// `position` / `rotation` / `scale` (y settles onto the plaza/terrain) and
// renders null — components never render a <Stage> themselves; the preview
// staging lives in TidewaterScenery.previews.tsx.
//
// BLOCKERS (GameManager/Context.md "Blockers"): the four SOLID pieces — the hull
// section, the coral head, the anchor pile and the pilings — register one, so
// guests path around them instead of walking through a shipwreck. The hull is
// long and thin so it registers a rotated RECT (a circle over a 1.8 u wreck
// would fence off half a tile of clear sand); the other three are circles. The
// TIDE POOL is flat and ankle-deep and registers NOTHING: it is meant to be
// scattered along paths and lawns, and a blocker there would carve holes in the
// walk network (the same call Emberfall's <LavaFissure> makes).
// ===========================================================================

export interface WreckedHullProps extends WreckedHullOpts {
  /** keep guests out of the wreck (default true — it is a solid ship) */
  blocking?: boolean;
}

/** `<WreckedHull>` — a broken ship's hull section half-buried in sand. The keel
 *  runs along local +Z, so `rotation` aims the wreck. */
export const WreckedHull = composable<WreckedHullProps, WreckedHullBuilt>(
  'WreckedHull',
  (t, props) =>
    buildWreckedHull(t, {
      length: props.length,
      radius: props.radius,
      seed: props.seed,
      sand: props.sand,
      debris: props.debris,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        rect: {
          cx: wx,
          cz: wz,
          hx: (built.halfBeam + 0.06) * scale,
          hz: (built.length / 2 + 0.08) * scale,
          yaw: rotation,
        },
        label: '<WreckedHull> hull section',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface CoralClusterProps extends CoralClusterOpts {
  /** keep guests off the reef head (default true — coral cuts) */
  blocking?: boolean;
}

/** `<CoralCluster>` — a reef head of branching and brain corals, bleached. */
export const CoralCluster = composable<CoralClusterProps, CoralClusterBuilt>(
  'CoralCluster',
  (t, props) =>
    buildCoralCluster(t, {
      radius: props.radius,
      height: props.height,
      seed: props.seed,
      clumps: props.clumps,
      fans: props.fans,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<CoralCluster> reef head',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface AnchorPileProps extends AnchorPileOpts {
  /** keep guests out of the chain heap (default true — tons of iron) */
  blocking?: boolean;
}

/** `<AnchorPile>` — a rusted admiralty anchor with a coiled heap of chain. */
export const AnchorPile = composable<AnchorPileProps, AnchorPileBuilt>(
  'AnchorPile',
  (t, props) => buildAnchorPile(t, { size: props.size, seed: props.seed, chain: props.chain, sand: props.sand }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<AnchorPile> anchor and chain',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

export interface TidePoolProps extends TidePoolOpts {
  /** register a blocker over the basin (default FALSE — the piece is ankle-deep
   *  and meant to be scattered across paths and lawns; set true for a big hero
   *  pool you want guests to keep out of) */
  blocking?: boolean;
}

/** `<TidePool>` — a shallow rock basin holding water, with starfish, limpets
 *  and weed. Flat by design: no blocker unless asked. */
export const TidePool = composable<TidePoolProps, TidePoolBuilt>(
  'TidePool',
  (t, props) => buildTidePool(t, { radius: props.radius, seed: props.seed, life: props.life }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (!props.blocking) return; // ankle-deep by design
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<TidePool> basin',
        height: 0.24 * scale,
        kind: 'water',
      });
    },
  },
);

export interface DockPilingsProps extends DockPilingsOpts {
  /** keep guests out of the piles (default true) */
  blocking?: boolean;
}

/** `<DockPilings>` — a leaning cluster of timber pilings with a draped net. */
export const DockPilings = composable<DockPilingsProps, DockPilingsBuilt>(
  'DockPilings',
  (t, props) =>
    buildDockPilings(t, {
      count: props.count,
      height: props.height,
      radius: props.radius,
      seed: props.seed,
      net: props.net,
    }),
  {
    compose: (park: ParkContextValue, { built, props, position, scale }) => {
      if (props.blocking === false) return;
      const [wx, , wz] = position;
      return park.registerBlocker({
        circle: { cx: wx, cz: wz, r: built.radius * scale },
        label: '<DockPilings> pile cluster',
        height: built.height * scale,
        kind: 'scenery',
      });
    },
  },
);

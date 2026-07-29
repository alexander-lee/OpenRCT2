import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { box, cyl, mat, mtx, mergedBoxes, mergedParts, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec, StageApi } from '../Stage';
import { hash01 } from '../ColorKit';
import { buildPeep, cadenceForSpeed, SHIRTS, SKIN_TONES, HAIRS, TROUSERS } from '../Guest';
import { buildNeonSign } from '../NeonSign';
import { PULSE_PALETTE } from '../Discotron';
import { composable } from '../Park';
import type { ComposableBuilt, ComposableProps, ParkContextValue } from '../Park';
import { UIWindow, UI_TEXT } from '../UIWindow';

// ---------------------------------------------------------------------------
// BigPiano — "The Big Piano", attraction 3 of the PULSE DISTRICT (the disco
// quarter whose centrepiece is <DanceFloor>, whose spinner is <Discotron> and
// whose coaster is <Bassline>).
//
// IT IS NOT A RIDE. No queue, no station, no hut, no vehicle, no FSM, no
// `registerRide`. It is a `composable(...)` SCENERY-class component — the
// components/MagicMirror / components/Fence shape — so none of the ride
// placement rules (front/exit/board, lane trims, corridor sweeps) apply. It is
// an oversized WALK-ON keyboard: guests step across the keys, and every key a
// guest's ground position crosses DEPRESSES, LIGHTS UP and sounds a note (a
// felt hammer swings back into the strings and the note lamp on the fallboard
// lights — this system has no audio, so the "note" is entirely a visual event).
//
// HOW THE INTERACTION IS WIRED — three parts, and it REUSES the sim rather than
// forking it:
//
//   1. PER-KEY HIT DETECTION from this component's own side. The updater reads
//      `manager().guests()` (a copied, read-only accessor) once a frame, takes
//      ONE matrix inverse for the whole frame and transforms each guest into the
//      piano's LOCAL frame — then resolves the key under them in O(1): a black
//      key from a precomputed x-slot lookup, else the white index by division.
//      No per-key loop per guest, no `worldToLocal` per guest (that inverts the
//      matrix on every call and a busy park has dozens of guests). Nothing is
//      ever written back into the sim.
//   2. GUESTS STOP ON IT because `linger` (default true) registers a GameManager
//      WATCH ZONE over the keybed (`registerWatchZone`) — a guest who wanders
//      onto the keys enters PeepState 'watching', turns to face the case for a
//      hashed 5-11 s with their weight on one key, then walks on, and cannot
//      re-latch for the manager's 30 s per-guest cooldown.
//      **NOT `registerDanceZone`:** a dance dwell is a hashed 10-30 s and
//      'dance' is an ACTION taken while the state is still 'walking', so a long
//      dance trips validatePark's "stood still > 25 sim-s while walking"
//      stuck-guest gate on its own — reproduced identically at cooldown 0 and
//      cooldown 30, i.e. NOT fixable with the cooldown. 'watching' is a
//      stationary STATE the validator's stuck detector resets on.
//   3. CLICKING IT opens a themed <UIWindow> through the SHARED Stage pick path:
//      the root group carries a generic `userData.pickRef`, which Stage's
//      `carrierOf` and <Park>'s `onPick` both dispatch. No local raycast — that
//      path already gets the parent-chain visibility test, real-geometry-before-
//      click-proxy ordering, the drag threshold and per-inset cameras right.
//
// ONE CLOCK, ABSOLUTE. The light show runs on the raw Stage clock (a club never
// stops) exactly as <Discotron>'s does; the piano has no motor and no ride FSM,
// so there is nothing behind a `createMotionGate` at all — the only non-lighting
// motion is the keys and hammers, and those are driven by real guest positions.
// The beat is the district's own BEAT_HZ = 2.2 and the palette is
// PULSE_PALETTE, imported from <Discotron> and never re-derived.
//
// Budget: 2 real PointLights of its own (+ the marquee's own = 3 of 4), ZERO
// particles (every glow is emissive or an additive mesh), static repeats through
// mergedBoxes/mergedParts, fine detail tagged `userData.lodDetail`.
// Deterministic — hashed sines only, absolute-time updater, no Math.random /
// Date.now.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE DISTRICT BEAT — the one clock. Identical to <DanceFloor>'s tile clock,
// <Discotron>'s light show and <PulseScenery>'s pieces; the helpers are
// module-private in Discotron, so (exactly like Bassline and PulseScenery) they
// are re-declared here rather than re-invented. Change these and the district
// drifts.
// ---------------------------------------------------------------------------
/** the district beat — the SAME rate <DanceFloor> flashes its tiles at */
export const BEAT_HZ = 2.2;
/** integer beat index (colours STEP once per beat) */
const beatStep = (time: number, off = 0) => Math.floor(time * BEAT_HZ + off);
/** 0.55…1 bloom that DIPS exactly on the colour change (DanceFloor's curve) */
const beatPulse = (time: number, ph = 0) => 0.55 + 0.45 * Math.abs(Math.sin(Math.PI * (time * BEAT_HZ + ph)));
/** sharp downbeat spike — 1 on the beat, decaying to ~0 across it */
const beatKick = (time: number, ph = 0) => {
  const f = (((time * BEAT_HZ + ph) % 1) + 1) % 1;
  return Math.exp(-7 * f);
};
/** wrap-safe PULSE_PALETTE lookup (negative indices included) */
const paletteAt = (i: number) => PULSE_PALETTE[((i % PULSE_PALETTE.length) + PULSE_PALETTE.length) % PULSE_PALETTE.length];

const smooth = (k: number) => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- materials: the district greys, byte-identical to Discotron's -----------
const GRAPHITE = 0x3a3d45;
const GRAPHITE_D = 0x2a2d34;
const GLOSS = 0x16171c;
const DECK = 0x21232a;
const CHROME = 0xa6adb6;
const CONCRETE = 0x9b9a96;
const MAGENTA = 0xd815b8;
const CYAN = 0x18c8d8;
/** the WHITE keys: bone acrylic, not paper white — a pure-white slab blows out
 *  under the Stage's noon sun and loses the bevel that makes a key a key */
const IVORY = 0xe4e2d8;
/** felt: hammer heads and the strip along the back of the keybed */
const FELT = 0xb14a5e;
const STRING = 0xbfc4cc;

const CHROMEY = { tex: 'metal' as const, metal: 0.32, rough: 0.3 };
const GLOSSY = { tex: 'plastic' as const, rough: 0.2 };
const CRETE = { tex: 'concrete' as const, rough: 0.94 };

/** an EMISSIVE lamp material — lit geometry that also glows */
const lamp = (t: typeof THREE, tint: number, emi = 0.2) =>
  new t.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: emi, roughness: 0.35 });
/** THE NOTE-FLARE FALLOFF — a 64 × 128 radial-gradient CanvasTexture, drawn once
 *  and cached module-level (the Restroom/RideEntrance procedural-canvas pattern:
 *  paths and gradients only, no fillText, no assets).
 *
 *  It exists because a bare additive QUAD is hard-edged: the first in-park render
 *  had a flat violet RECTANGLE standing beside the guest like a paper card. Used
 *  as both `alphaMap` and `emissiveMap` the same quad fades to nothing at its
 *  edges and reads as light coming off the key. */
let _flareTex: THREE.CanvasTexture | null = null;
function flareTexture(t: typeof THREE): THREE.CanvasTexture {
  if (_flareTex) return _flareTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const x = c.getContext('2d')!;
  // OPAQUE GREYSCALE, not a white-to-transparent gradient: three's `alphaMap`
  // samples the texture's GREEN channel, and a canvas gradient that fades only
  // its ALPHA leaves green at 255 everywhere — the flare stayed a hard-edged
  // violet card through a whole render round because of it.
  x.fillStyle = '#000000';
  x.fillRect(0, 0, 64, 128);
  const g = x.createRadialGradient(32, 104, 2, 32, 104, 92);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.28, '#a0a0a0');
  g.addColorStop(0.62, '#2e2e2e');
  g.addColorStop(1, '#000000');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 128);
  const tex = new t.CanvasTexture(c);
  _flareTex = tex;
  return tex;
}

/** a PURE-LIGHT additive material (Discotron's exact recipe): black base +
 *  emissive tint + AdditiveBlending + no depth write, so the sun can never
 *  shade it */
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

// ---------------------------------------------------------------------------
// GEOMETRY — local frame: x = the KEY RUN, the case is at −z, the player's side
// is +z, y = 0 is the ground (the path the keys are laid into).
// ---------------------------------------------------------------------------
/** white-key pitch (centre to centre) */
const WHITE_PITCH = 0.32;
/** the dark line between two white keys */
const WHITE_GAP = 0.03;
/** how far a key reaches from the case out toward the player */
const WHITE_LEN = 1.3;
/** the keybed base plate the keys are hinged to */
const PLATE_H = 0.028;
/** white-key body thickness */
const WHITE_H = 0.055;
/** black keys are a RAISED PANEL on the back half of the whites, not a separate
 *  tall block: this is a floor a guest walks over, so the sharps stand only
 *  0.02 proud (steppable) instead of the 0.03+ a real keyboard uses */
const BLACK_RISE = 0.02;
const BLACK_W = 0.185;
const BLACK_LEN = 0.8;
/** THE WALKING SURFACE: the top of a white key WHEN IT IS FULLY PRESSED, which
 *  is the only pose a guest's key is ever in while they are standing on it (a
 *  fully pressed key is LEVEL — see KEY_TRAVEL). Real sim guests walk at path
 *  height, so they stand this far into the keys (the call <LightTiles> (0.105)
 *  and <DanceFloor> (0.175) already make). Give the two <Paths> nodes at the
 *  keybed ends this elevation if you want feet exactly ON the keys. */
export const KEY_SURFACE_Y = PLATE_H + WHITE_H;
/** the hinge line: keys pivot about their BACK edge, like a real key */
const HINGE_Z = -WHITE_LEN / 2;

/** HOW FAR THE FRONT TIP OF A NATURAL TRAVELS between fully up and fully down.
 *
 *  ────────────────────────────────────────────────────────────────────────────
 *  THE STROKE RUNS **UP → LEVEL**, NOT **LEVEL → DOWN**. A key at rest is tilted
 *  TIP-UP by `REST_TILT` and a fully pressed key is LEVEL and flat.
 *
 *  This is the fix for "when a guest steps on a key it clips with the ground",
 *  and it is forced by arithmetic, not taste. The rig is FLUSH-MOUNTED: a
 *  guest's feet stay on the path/plaza surface, so the key under them has to end
 *  up at that surface too. A key that is level at rest and rotates DOWN when
 *  pressed therefore spends its entire stroke BELOW the paving — measured in a
 *  real park, the old 0.055 rad tilt put the top face of a pressed natural
 *  51.7 mm UNDER the plaza slab (a sharp 22.1 mm), i.e. the key vanished into
 *  the pavement and only its note flare marked the spot. Worse, of its nominal
 *  71.5 mm of travel only the first 14 mm was ever above ground: 80 % of the
 *  press was invisible.
 *
 *  Inverting the stroke is the only way to buy back visible travel, because for
 *  a flush-mounted key the geometry is a hard identity:
 *
 *      resting tip height above the floor  =  visible travel  +  clearance
 *
 *  So the tip now RESTS proud and comes down to meet the paving, and the whole
 *  stroke happens in the open air. 42 mm all above ground beats 71.5 mm of which
 *  57 mm was underground, and the pressed key is dead level with the ground the
 *  guest is standing on — which is exactly what "the key stops at the floor"
 *  looks like. A pure vertical translation still does not read; this is still a
 *  rotation about the back edge, so the back of every key stays pinned to the
 *  balance rail and never gaps against the case.
 *
 *  Kept at 42 mm rather than pushed higher because the resting tip lip must stay
 *  under WHITE_H (0.055) or the front of an un-pressed key lifts clear off the
 *  ground and shows daylight underneath — 0.042 leaves the tip underside within
 *  a few mm of the paving, and the keyslip (below) covers the remainder. */
const KEY_TRAVEL = 0.042;
/** the last 2 mm of the stroke is the whole key SETTLING on its balance rail —
 *  a pressed key beds down as well as levelling out, which keeps the "sinks a
 *  hair on its rail" detail the close-up preview was built around */
const PRESS_SETTLE = 0.002;
/** the resting TIP-UP angle that produces KEY_TRAVEL at the tip of a natural
 *  (rad). Sharps are shorter levers, so they travel BLACK_LEN·REST_TILT ≈ 27 mm
 *  — less than a natural, which is what a real keyboard does too. */
const REST_TILT = (KEY_TRAVEL - PRESS_SETTLE) / WHITE_LEN;
/** FLUSH-MOUNT CLEARANCE: how far a fully pressed natural's top face sits above
 *  the walked surface it is set into. It has to cover the ~6 mm by which
 *  <PathNetwork>'s plaza top (pathY + 0.096) overshoots the `walkYAt` the mount
 *  samples (pathY + 0.09), and still leave the key visibly proud of the paving —
 *  at exactly level the paving simply wins and the naturals disappear. */
const PRESS_CLEAR = 0.02;
/** THE KEYSLIP. The chrome sill along the three OPEN sides of the keybed, and a
 *  real part now rather than a 22 mm bead: it is what hides the bottom of the
 *  stroke and the few mm of air under a resting key's raised tip. The ±x ends
 *  stay LOWER than the front, because those are the walk-on edges — 25 mm proud
 *  of the paving is a kerb a guest steps over, which is exactly what the old
 *  nosing was sized for. */
const SLIP_TOP = KEY_SURFACE_Y + 0.013;
const SLIP_END_TOP = KEY_SURFACE_Y + 0.005;
/** the case (fallboard, action, harp, marquee posts) occupies −z of this */
const CASE_Z0 = HINGE_Z - 0.04;
const CASE_D = 0.8;
/** case centre in z — also the planted footprint, deliberately BEHIND the keys
 *  so the walk-on surface is never registered as ground contact */
const CASE_CZ = CASE_Z0 - CASE_D / 2;
/** the felt hammer rail */
const RAIL_Y = 0.3;
const RAIL_Z = CASE_Z0 - 0.24;

/** white keys per octave, as semitone offsets */
const WHITE_STEPS = [0, 2, 4, 5, 7, 9, 11];
/** a black key follows white i when (i mod 7) is one of these (C♯ D♯ F♯ G♯ A♯) */
const SHARP_AFTER = new Set([0, 1, 3, 4, 5]);
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// ---------------------------------------------------------------------------
// state published to the UI window + the behaviour harness
// ---------------------------------------------------------------------------
export interface BigPianoState {
  /** how many keys are held down right now */
  keysDown: number;
  /** distinct guests standing on the keybed right now */
  players: number;
  /** total note strikes since the piano was built */
  notesPlayed: number;
  /** the note that sounded last, e.g. `'F♯4'` */
  lastNote: string | null;
  /** the key index that sounded last (into `press()`) */
  lastKey: number | null;
  /** the guest who sounded it (sim guest id; −1 = the demo player) */
  lastPlayer: number | null;
  /** the deepest key press right now, 0…1 — the harness's "a key really moved" */
  deepest: number;
  /** how long the longest-held key has been down, in seconds */
  held: number;
  /** true when a linger (watch) ZONE was registered with the GameManager */
  zone: boolean;
}

export interface BigPianoHandle {
  api: StageApi;
  /** the piano's root group — the pick target and the `pianoRef` carrier */
  group: THREE.Object3D;
  state(): BigPianoState;
}

/** the manager surface the piano reads / registers through. Every member is
 *  OPTIONAL-CALLED: the piano works with none of them. */
export interface PianoMgr {
  guests?: () => { id: number; position: [number, number, number]; hidden?: boolean; gone?: boolean }[];
  /** THE ZONE THIS COMPONENT WANTS. Guests inside enter PeepState 'watching',
   *  face `faceAt` for a hashed few seconds with their weight on a key, then
   *  walk on — with a per-guest re-latch cooldown (GameManager/registry.ts). */
  registerWatchZone?: (cfg: {
    center: [number, number];
    halfW: number;
    halfD: number;
    rotation?: number;
    faceAt?: [number, number];
    linger?: [number, number];
    cooldown?: number;
    gate?: { happiness?: number; energy?: number };
  }) => unknown;
}

export interface BigPianoOpts {
  /** white keys in the run (default 15 = two octaves + the top C; clamped
   *  7…15, so `count` 7 is one octave). The footprint scales with it. */
  count?: number;
  /** hashed-variation salt (default 1) */
  seed?: number;
  /** force keys down for a reproducible still: an index list, or `true` for a
   *  hashed three-note chord. Bypasses guest detection entirely. */
  chord?: number[] | boolean;
  /** a DECORATIVE demo player who walks the keyboard, stops mid-run to dance and
   *  walks off on a deterministic 18-second loop — fed through EXACTLY the same
   *  hit detection a sim guest goes through, so a standalone preview exercises
   *  the real logic. Default: ON under a <ScenePreview>, OFF inside a real
   *  <Park> (the fleet's decoration-off-when-registered convention). */
  demo?: boolean;
}

export interface BigPianoBuilt extends ComposableBuilt {
  state: () => BigPianoState;
  /** live per-key press, 0 = up, 1 = fully down (index 0 = leftmost white key,
   *  then in x order; `keyInfo()` names them) — the behaviour probe's proof that
   *  a KEY MOVED rather than that a guest was merely nearby */
  press: () => number[];
  /** static per-key description, same order as `press()` */
  keyInfo: () => { x: number; black: boolean; note: string }[];
  /** the walking surface half-extents in local x / z (kerb included) */
  half: [number, number];
  /** wired by the `compose` hook in real parks */
  attach: (mgr: PianoMgr | null, zone: boolean) => void;
}

interface Key {
  mesh: THREE.Mesh;
  m: THREE.MeshStandardMaterial;
  /** hammer group, pivoting on the rail behind the fallboard */
  hammer: THREE.Object3D;
  x: number;
  black: boolean;
  /** semitone from C3 */
  semi: number;
  /** pitch class 0…11 */
  cls: number;
  note: string;
  /** hashed beat-phase offset for the attract pattern */
  ph: number;
  /** this note's palette colour, allocated ONCE (a `new Color` per key per
   *  frame is 25 allocations a frame for nothing) */
  tint: THREE.Color;
  /** the key's unlit body colour */
  base: THREE.Color;
  press: number;
  down: boolean;
  /** seconds this key has been held */
  held: number;
  hit: boolean;
  hitBy: number;
  /** decaying strike envelope, 1 at the strike */
  strike: number;
}

export function buildBigPiano(t: typeof THREE, opts: BigPianoOpts = {}): BigPianoBuilt {
  const group = new t.Group();
  const seed = opts.seed ?? 1;
  const h = (n: number) => hash01(seed * 2.71 + n * 4.13);
  const whites = Math.max(7, Math.min(15, Math.round(opts.count ?? 15)));
  const field = whites * WHITE_PITCH;
  const halfW = field / 2;

  // =========================================================================
  // 1. THE KEYBED — base plate, felt strip, chrome nosing
  // =========================================================================
  group.add(
    box(t, [field + 0.1, PLATE_H, WHITE_LEN + 0.07], DECK, [0, PLATE_H / 2, 0], {
      rough: 0.5,
      tex: 'metal',
      repeat: [Math.max(2, whites), 2],
    }),
  );
  // a concrete pad a hair proud of nothing, tucked UNDER the plate: it is what
  // stops a dark keybed reading as a hole when the piano is laid on grass
  group.add(box(t, [field + 0.24, 0.014, WHITE_LEN + 0.2], CONCRETE, [0, 0.007, 0], { ...CRETE, repeat: [Math.max(3, whites), 3] }));
  // the felt strip along the back of the keys (the real thing's key-slip felt)
  group.add(box(t, [field + 0.06, 0.022, 0.05], FELT, [0, PLATE_H + 0.011, HINGE_Z + 0.02], { tex: 'fabric', rough: 0.95 }));
  // THE KEYSLIP — chrome sill on the three OPEN sides (±x ends and the +z
  // front). The −z side is the case, so it gets none.
  //
  // It rises from the base plate to SLIP_TOP / SLIP_END_TOP rather than sitting
  // 0.022 proud of the plate: under a flush mount the plate, the pad and the old
  // bead were ALL buried under the paving, so the keybed had no visible frame at
  // all and the keys read as loose slabs dropped on the pavement. At these
  // heights the slip stands ~33 mm (front) / ~25 mm (ends) above the walked
  // surface — a piano's real keyslip, and the thing that occludes the bottom of
  // the key stroke and the few mm of air beneath a resting key's raised tip.
  {
    const slipH = SLIP_TOP - PLATE_H;
    const endH = SLIP_END_TOP - PLATE_H;
    const nose: MergedBoxSpec[] = [
      { dims: [field + 0.16, slipH, 0.05], pos: [0, PLATE_H + slipH / 2, WHITE_LEN / 2 + 0.045] },
      { dims: [0.05, endH, WHITE_LEN + 0.12], pos: [-(halfW + 0.055), PLATE_H + endH / 2, 0.02] },
      { dims: [0.05, endH, WHITE_LEN + 0.12], pos: [halfW + 0.055, PLATE_H + endH / 2, 0.02] },
    ];
    const nm = mergedBoxes(t, nose, CHROME, CHROMEY);
    nm.castShadow = false;
    group.add(nm);
  }

  // =========================================================================
  // 2. THE KEYS — one mesh + one material each (they colour and move alone),
  //    hinged about their BACK edge. Two cached geometries for the whole set.
  // =========================================================================
  const keys: Key[] = [];
  const whiteGeo = new t.BoxGeometry(WHITE_PITCH - WHITE_GAP, WHITE_H, WHITE_LEN);
  whiteGeo.translate(0, WHITE_H / 2, WHITE_LEN / 2); // origin → the hinge
  const blackGeo = new t.BoxGeometry(BLACK_W, WHITE_H + BLACK_RISE, BLACK_LEN);
  blackGeo.translate(0, (WHITE_H + BLACK_RISE) / 2, BLACK_LEN / 2);

  /** the hammer prototype dims — a felt head on a tapered shank, ONE mesh */
  const addKey = (x: number, black: boolean, semi: number) => {
    const cls = ((semi % 12) + 12) % 12;
    const m = black
      ? new t.MeshStandardMaterial({ color: GLOSS, emissive: paletteAt(cls), emissiveIntensity: 0, roughness: 0.52 })
      : new t.MeshStandardMaterial({ color: IVORY, emissive: paletteAt(cls), emissiveIntensity: 0, roughness: 0.5 });
    const mesh = new t.Mesh(black ? blackGeo : whiteGeo, m);
    mesh.position.set(x, PLATE_H, HINGE_Z);
    // the RESTING pose is tip-UP (see KEY_TRAVEL) — set here as well as in the
    // updater so a rig that is never ticked (a still, a torn-down preview) is
    // already in a legal pose instead of one frame of level keys
    mesh.rotation.x = -REST_TILT;
    mesh.castShadow = false; // a 0.055-thick key casting on itself only stipples
    mesh.receiveShadow = true;
    group.add(mesh);
    // the HAMMER: felt head on a tapered shank, pivoting on the rail. One mesh
    // per hammer (they move alone) sharing two cached geometries.
    const hammer = new t.Group();
    hammer.position.set(x, RAIL_Y, RAIL_Z);
    const head = cyl(t, 0.03, 0.011, 0.19, FELT, [0, 0.095, 0], { tex: 'fabric', rough: 0.92, seg: 6 });
    head.castShadow = false;
    hammer.add(head);
    hammer.userData.lodDetail = true; // fine action detail — shed beyond NEAR
    group.add(hammer);
    keys.push({
      mesh,
      m,
      hammer,
      x,
      black,
      semi,
      cls,
      note: `${NOTE_NAMES[cls]}${3 + Math.floor(semi / 12)}`,
      ph: h(keys.length + 3),
      tint: new t.Color(paletteAt(cls)),
      base: new t.Color(black ? GLOSS : IVORY),
      press: 0,
      down: false,
      held: 0,
      hit: false,
      hitBy: -2,
      strike: 0,
    });
  };

  for (let i = 0; i < whites; i += 1) {
    const oct = Math.floor(i / 7);
    addKey(-halfW + WHITE_PITCH * (i + 0.5), false, oct * 12 + WHITE_STEPS[i % 7]);
  }
  /** where each black key lives, so both the geometry and the x-slot lookup are
   *  built from ONE list (a second hand-written copy of this pattern is how the
   *  lookup and the meshes drift apart) */
  const blacks: { x: number; semi: number }[] = [];
  for (let i = 0; i < whites - 1; i += 1) {
    if (!SHARP_AFTER.has(i % 7)) continue;
    blacks.push({ x: -halfW + WHITE_PITCH * (i + 1), semi: Math.floor(i / 7) * 12 + WHITE_STEPS[i % 7] + 1 });
  }
  /** index of the first black key in `keys` — everything before it is white, in
   *  left-to-right order, which is what makes `whiteIndexOf` a division */
  const BLACK0 = keys.length;
  blacks.forEach((b) => addKey(b.x, true, b.semi));

  // ---- THE X-SLOT LOOKUP: local x → black key index, or −1 ----------------
  // A 0.02 u lattice over the key run. This is why hit detection is O(1) per
  // guest instead of O(keys): a foot on a sharp resolves with one array read.
  const SLOT = 0.02;
  const SLOTS = Math.ceil(field / SLOT) + 2;
  const blackAt = new Int16Array(SLOTS).fill(-1);
  blacks.forEach((b, bi) => {
    const s0 = Math.max(0, Math.floor((b.x - BLACK_W / 2 + halfW) / SLOT));
    const s1 = Math.min(SLOTS - 1, Math.ceil((b.x + BLACK_W / 2 + halfW) / SLOT));
    for (let s = s0; s <= s1; s += 1) blackAt[s] = BLACK0 + bi;
  });

  // =========================================================================
  // 3. THE CASE — low fallboard with the note lamps, the exposed ACTION, the
  //    harp, and the marquee on its posts. Everything here is at −z, off the
  //    walked surface.
  // =========================================================================
  const caseParts: MergedBoxSpec[] = [];
  const glossParts: MergedBoxSpec[] = [];
  // base rail + end blocks: the case is a box the keybed slots into
  caseParts.push({ dims: [field + 0.12, 0.1, CASE_D], pos: [0, 0.05, CASE_CZ] });
  for (const s of [-1, 1] as const) {
    // the CHEEK BLOCKS sit on the CASE side only. They deliberately do NOT wrap
    // the ±x ends of the keybed: those ends are the walk-on edges, and a 0.3-tall
    // cheek across them would fence off the whole point of the piece.
    glossParts.push({ dims: [0.22, 0.3, CASE_D + 0.06], pos: [s * (halfW - 0.02), 0.15, CASE_CZ] });
  }
  // the FALLBOARD: low, so the action behind it stays visible from the front
  glossParts.push({ dims: [field - 0.36, 0.16, 0.06], pos: [0, PLATE_H + 0.08, CASE_Z0 - 0.03], rotX: -0.1 });
  caseParts.push({ dims: [field - 0.36, 0.035, 0.09], pos: [0, PLATE_H + 0.165, CASE_Z0 - 0.035] }); // nameboard cap
  group.add(mergedBoxes(t, caseParts, GRAPHITE_D, { tex: 'metal', metal: 0.28, rough: 0.5, repeat: [Math.max(3, whites), 1] }));
  group.add(mergedBoxes(t, glossParts, GLOSS, GLOSSY));

  const chromeParts: PartSpec[] = [];
  // the hammer rail, and a balance rail under the keys' hinge line
  chromeParts.push({
    geo: new t.CylinderGeometry(0.022, 0.022, field + 0.06, 8),
    matrix: mtx(t, [0, RAIL_Y, RAIL_Z], [0, 0, Math.PI / 2]),
  });
  chromeParts.push({
    geo: new t.CylinderGeometry(0.016, 0.016, field + 0.06, 6),
    matrix: mtx(t, [0, PLATE_H + 0.02, HINGE_Z - 0.03], [0, 0, Math.PI / 2]),
  });
  // rail standards
  for (const s of [-1, 1] as const)
    chromeParts.push({
      geo: new t.BoxGeometry(0.05, RAIL_Y - 0.1, 0.06),
      matrix: mtx(t, [s * (halfW - 0.06), (RAIL_Y + 0.1) / 2, RAIL_Z]),
    });

  // ---- THE HARP: a leaning soundboard with real strings over it -----------
  const HARP_LEAN = 0.34;
  const HARP_H = 0.95;
  const HARP_CY = 0.1 + Math.cos(HARP_LEAN) * (HARP_H / 2);
  const HARP_CZ = CASE_Z0 - CASE_D + 0.1 - Math.sin(HARP_LEAN) * (HARP_H / 2);
  group.add(
    box(t, [field + 0.04, HARP_H, 0.05], GRAPHITE, [0, HARP_CY, HARP_CZ], {
      tex: 'metal',
      metal: 0.3,
      rough: 0.45,
      repeat: [Math.max(3, whites), 2],
      rotX: -HARP_LEAN,
    }),
  );
  // the strings: one merged mesh, one material — they all shimmer together
  const stringParts: PartSpec[] = [];
  for (let i = 0; i < whites * 2 - 1; i += 1) {
    const sx = -halfW + 0.08 + (i * (field - 0.16)) / Math.max(1, whites * 2 - 2);
    stringParts.push({
      geo: new t.CylinderGeometry(0.006, 0.006, HARP_H - 0.1, 4),
      matrix: mtx(t, [sx, HARP_CY, HARP_CZ + 0.035 * Math.cos(HARP_LEAN)], [-HARP_LEAN, 0, 0]),
    });
  }
  const stringMat = new t.MeshStandardMaterial({
    color: STRING,
    emissive: new t.Color(CYAN),
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.34,
  });
  const strings = mergedParts(t, stringParts, stringMat);
  strings.castShadow = false;
  strings.userData.lodDetail = true;
  group.add(strings);
  // THE BACK POSTS. A real upright piano's back is a frame of heavy posts, and
  // the alternate-angle render is why they are here: from behind, the harp plate
  // and the marquee backboard were two flat black rectangles. Five posts, two
  // cross rails and a lighter STEEL tone break it up, so the piano is an object
  // from every side (the same call MagicMirror's stay legs make).
  {
    const nz = -Math.sin(HARP_LEAN);
    const ny = -Math.cos(HARP_LEAN); // the plate's BACK normal, in (y, z)
    const back: PartSpec[] = [];
    const at = (off: number) => [0, HARP_CY + nz * off, HARP_CZ + ny * off] as [number, number, number];
    for (let i = 0; i < 5; i += 1) {
      const px = -halfW + 0.3 + (i * (field - 0.6)) / 4;
      const p = at(0.055);
      back.push({ geo: new t.BoxGeometry(0.075, HARP_H * 0.94, 0.07), matrix: mtx(t, [px, p[1], p[2]], [-HARP_LEAN, 0, 0]), uv: [1, 3] });
    }
    for (const f of [0.28, -0.3]) {
      const p = at(0.05);
      back.push({
        geo: new t.BoxGeometry(field - 0.4, 0.06, 0.055),
        matrix: mtx(t, [0, p[1] + nz * 0 + f * Math.cos(HARP_LEAN), p[2] + f * -Math.sin(HARP_LEAN)], [-HARP_LEAN, 0, 0]),
        uv: [Math.max(3, whites), 1],
      });
    }
    const bp = mergedParts(t, back, mat(t, 0x6e737d, { tex: 'metal', metal: 0.24, rough: 0.42, bump: 0.03 }));
    group.add(bp);
  }
  // tuning-pin bar at the top of the harp and a hitch bar at its foot
  const harpTopY = 0.1 + Math.cos(HARP_LEAN) * HARP_H;
  const harpTopZ = CASE_Z0 - CASE_D + 0.1 - Math.sin(HARP_LEAN) * HARP_H;
  chromeParts.push({
    geo: new t.CylinderGeometry(0.026, 0.026, field + 0.04, 8),
    matrix: mtx(t, [0, harpTopY, harpTopZ + 0.05], [0, 0, Math.PI / 2]),
  });
  chromeParts.push({
    geo: new t.CylinderGeometry(0.02, 0.02, field + 0.04, 6),
    matrix: mtx(t, [0, 0.12, CASE_Z0 - CASE_D + 0.14], [0, 0, Math.PI / 2]),
  });

  // ---- THE MARQUEE: a real buildNeonSign on a header truss ---------------
  const sign = buildNeonSign(t, { text: 'BIG PIANO', color: MAGENTA, secondary: CYAN, scale: 0.3, backboard: true });
  const SIGN_Y = harpTopY + 0.38;
  const SIGN_Z = harpTopZ - 0.05;
  // FIT THE MARQUEE TO THE PIANO. buildNeonSign auto-caps its own width at
  // 2.5 u, which is right for a 15-key run and far too wide for a 7-key one —
  // at `count` 7 the sign overhung its own posts and the piano wore a marquee
  // wider than itself. Scaling the built group is the cheap fix (it carries the
  // sign's own PointLight offset with it).
  const fit = Math.min(1, (field - 0.5) / Math.max(0.001, sign.width));
  sign.group.scale.setScalar(fit);
  const signW = sign.width * fit;
  const postX = Math.min(halfW - 0.1, signW / 2 + 0.16);
  const POST_TOP = SIGN_Y + 0.56 * fit;
  sign.group.position.set(0, SIGN_Y, SIGN_Z + 0.02);
  group.add(sign.group);
  // the posts stand BEHIND the harp (which is 4.8 u wide — a post inside that
  // width would spear it) on their own concrete footings, with a header truss
  // under the marquee and a cap rail over it
  const footings: MergedBoxSpec[] = [];
  for (const s of [-1, 1] as const) {
    chromeParts.push({ geo: new t.BoxGeometry(0.06, POST_TOP, 0.06), matrix: mtx(t, [s * postX, POST_TOP / 2, SIGN_Z]) });
    footings.push({ dims: [0.24, 0.06, 0.24], pos: [s * postX, 0.03, SIGN_Z] });
  }
  chromeParts.push({ geo: new t.BoxGeometry(postX * 2 + 0.12, 0.05, 0.06), matrix: mtx(t, [0, SIGN_Y - 0.06, SIGN_Z]) });
  chromeParts.push({ geo: new t.BoxGeometry(postX * 2 + 0.12, 0.04, 0.05), matrix: mtx(t, [0, POST_TOP - 0.02, SIGN_Z]) });
  group.add(mergedParts(t, chromeParts, mat(t, CHROME, CHROMEY)));
  group.add(mergedBoxes(t, footings, CONCRETE, CRETE));

  // =========================================================================
  // 4. THE LIGHT RIG — 12 chromatic note lamps, an LED chord bar over the
  //    harp, two note flares, a bloom plate, and two real PointLights.
  // =========================================================================
  /** the twelve NOTE LAMPS set into the nameboard: one per pitch class, so a
   *  sounded note reads even when the key that sounded it is under a guest */
  const lampMats: THREE.MeshStandardMaterial[] = [];
  const lampLevel = new Float32Array(12);
  {
    const spread = Math.min(field - 0.6, 2.5);
    for (let c = 0; c < 12; c += 1) {
      const m = lamp(t, paletteAt(c), 0.15);
      const mesh = new t.Mesh(new t.CylinderGeometry(0.026, 0.03, 0.02, 10), m);
      mesh.position.set(-spread / 2 + (c * spread) / 11, PLATE_H + 0.185, CASE_Z0 - 0.035);
      mesh.castShadow = false;
      mesh.userData.lodDetail = true;
      group.add(mesh);
      lampMats.push(m);
    }
  }
  /** the CHORD BAR: an LED tube along the top of the harp, on the beat */
  const barMat = lamp(t, paletteAt(0), 0.2);
  {
    const barParts: PartSpec[] = [];
    for (let i = 0; i < 24; i += 1)
      barParts.push({
        geo: new t.BoxGeometry((field - 0.2) / 26, 0.03, 0.035),
        matrix: mtx(t, [-halfW + 0.12 + (i * (field - 0.26)) / 23, harpTopY - 0.055, harpTopZ + 0.075]),
      });
    const bar = mergedParts(t, barParts, barMat);
    bar.castShadow = false;
    group.add(bar);
  }
  /** TWO NOTE FLARES — one additive patch each, MOVED to the key that just
   *  sounded and faded out. Two draw calls instead of one per key, and a struck
   *  note visibly blooms off the key it came from.
   *
   *  They lie FLAT on the key, not standing up off it. A vertical additive quad
   *  read as a violet paper CARD beside the guest in two consecutive in-park
   *  renders (a greyscale falloff map fixed the hard edge in principle and still
   *  did not survive the harness); flat on the key top its edges fall on the lit
   *  key itself, which is how <LightTiles>' bloom plate reads correctly too. */
  const flareMat = additive(t, MAGENTA, 1.2, 0.5);
  flareMat.alphaMap = flareTexture(t);
  flareMat.emissiveMap = flareTexture(t);
  const flares = [0, 1].map(() => {
    const q = new t.Mesh(new t.PlaneGeometry(WHITE_PITCH * 1.7, WHITE_LEN * 0.75), flareMat);
    q.rotation.x = -Math.PI / 2;
    // parked ON the keybed, not at the group origin: `Box3.setFromObject`
    // includes invisible children, so a quad left centred on y = 0 put the
    // measured footprint 0.28 u UNDERGROUND
    q.position.set(0, KEY_SURFACE_Y + 0.02, 0.05);
    q.visible = false;
    q.renderOrder = 4;
    q.castShadow = false;
    group.add(q);
    return { mesh: q, k: 0, age: 9 };
  });
  let flareNext = 0;
  /** ONE additive plate a hair over the keys: at night a lit floor washes the
   *  air above it, and it stops the keybed reading as coloured paint */
  const bloomMat = additive(t, paletteAt(0), 0.6, 0.06);
  const bloom = new t.Mesh(new t.PlaneGeometry(field + 0.05, WHITE_LEN + 0.02), bloomMat);
  bloom.rotation.x = -Math.PI / 2;
  // clear of the HIGHEST key top, which is a resting natural's raised tip
  // (KEY_SURFACE_Y + KEY_TRAVEL) — a flat plate parked at the pressed height
  // gets sliced by every un-pressed key in front of it
  bloom.position.set(0, KEY_SURFACE_Y + KEY_TRAVEL + 0.01, 0.005);
  bloom.castShadow = false;
  bloom.renderOrder = 3;
  group.add(bloom);
  /** the TWO real PointLights of the piano's own: house lights over the keybed,
   *  tinted to the note that just sounded (the marquee brings its own, so the
   *  piece totals 3 of the 4-light budget) */
  const houseLights = [-1, 1].map((s) => {
    const pl = new t.PointLight(paletteAt(0), 0, 4.2, 2);
    pl.position.set(s * field * 0.26, 0.92, -0.3);
    group.add(pl);
    return pl;
  });

  // =========================================================================
  // 5. THE DEMO PLAYER — decorative, deterministic, and fed through EXACTLY
  //    the same hit detection a sim guest goes through.
  // =========================================================================
  let demoPeep: ReturnType<typeof buildPeep> | null = null;
  if (opts.demo) {
    demoPeep = buildPeep(t, {
      skin: SKIN_TONES[Math.floor(h(70) * SKIN_TONES.length) % SKIN_TONES.length],
      shirt: SHIRTS[Math.floor(h(71) * SHIRTS.length) % SHIRTS.length],
      trousers: TROUSERS[Math.floor(h(72) * TROUSERS.length) % TROUSERS.length],
      hair: HAIRS[Math.floor(h(73) * HAIRS.length) % HAIRS.length],
      female: h(74) > 0.5,
      expression: 'happy',
    });
    demoPeep.group.scale.setScalar(0.5);
    group.add(demoPeep.group);
  }

  // =========================================================================
  // 6. THE INTERACTION
  // =========================================================================
  let mgr: PianoMgr | null = null;
  let zoneOn = false;
  const state: BigPianoState = {
    keysDown: 0,
    players: 0,
    notesPlayed: 0,
    lastNote: null,
    lastKey: null,
    lastPlayer: null,
    deepest: 0,
    held: 0,
    zone: false,
  };
  /** the FORCED chord (`chord` prop) — a reproducible still, resolved once */
  const forced: number[] = (() => {
    if (!opts.chord) return [];
    if (Array.isArray(opts.chord)) return opts.chord.filter((k) => k >= 0 && k < keys.length);
    // a hashed triad on the white keys: root, third, fifth
    const root = Math.floor(h(9) * Math.max(1, whites - 5));
    return [root, root + 2, root + 4].filter((k) => k < BLACK0);
  })();

  const lp = new t.Vector3();
  const inv = new t.Matrix4();
  /** scratch colours — allocated once, never per key per frame */
  const tmpCol = new t.Color();
  const WHITE = new t.Color(0xffffff);
  const players = new Set<number>();
  let lastT = -1;

  /** THE HIT TEST, in the piano's own local frame. O(1) per guest: one x-slot
   *  read for the sharps, one division for the naturals. Returns a key index or
   *  −1 for "not on the keybed". */
  const keyUnder = (x: number, z: number): number => {
    if (z < HINGE_Z - 0.02 || z > WHITE_LEN / 2 + 0.06) return -1;
    if (x < -halfW - 0.05 || x > halfW + 0.05) return -1;
    if (z <= HINGE_Z + BLACK_LEN) {
      const b = blackAt[Math.max(0, Math.min(SLOTS - 1, Math.floor((x + halfW) / SLOT)))];
      if (b >= 0) return b;
    }
    const w = Math.floor((x + halfW) / WHITE_PITCH);
    return Math.max(0, Math.min(whites - 1, w));
  };

  const update = (time: number) => {
    const dt = lastT < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    const nk = smooth(nightKOf(group));
    const gain = 0.4 + 1.1 * nk; // DanceFloor's own gain: ~40 % glow by day

    // ---- 6a. WHO IS STANDING ON WHICH KEY ------------------------------
    for (let i = 0; i < keys.length; i += 1) {
      keys[i].hit = false;
      keys[i].hitBy = -2;
    }
    players.clear();
    // the world matrix is what turns sim guests' WORLD positions into local
    // ones, and the inverse is taken ONCE for the whole frame — not once per
    // guest (worldToLocal inverts on every call) and never once per key.
    group.updateWorldMatrix(true, false);
    inv.copy(group.matrixWorld).invert();
    const mark = (id: number, wx: number, wy: number, wz: number) => {
      lp.set(wx, wy, wz).applyMatrix4(inv);
      const k = keyUnder(lp.x, lp.z);
      if (k < 0) return;
      keys[k].hit = true;
      keys[k].hitBy = id;
      players.add(id);
    };

    // the DEMO player first (it is a preview's only guest): an 18-second loop —
    // stride in across the keys, stop and dance in the middle, walk off.
    if (demoPeep) {
      const T = 18;
      const ph = ((time % T) + T) % T;
      const x0 = -halfW - 0.7;
      const x1 = Math.min(halfW - 0.5, x0 + 3.4);
      let x = x0;
      let walking = true;
      let dancing = false;
      if (ph < 7) x = x0 + ((x1 - x0) * ph) / 7;
      else if (ph < 12) {
        x = x1;
        walking = false;
        dancing = true;
      } else if (ph < 17) x = x1 + ((halfW + 0.9 - x1) * (ph - 12)) / 5;
      else {
        x = halfW + 0.9;
        walking = false;
      }
      demoPeep.group.visible = ph < 17;
      // the demo player stands ON the keys (their y is ours to set); a real sim
      // guest walks at path height — see KEY_SURFACE_Y
      demoPeep.group.position.set(x, KEY_SURFACE_Y, dancing ? 0.06 : 0.02);
      demoPeep.group.rotation.y = dancing ? Math.PI : Math.PI / 2;
      if (dancing) demoPeep.pose.setState('dance', BEAT_HZ);
      else if (walking) demoPeep.pose.setState('walk', cadenceForSpeed(0.49, 0.5));
      else demoPeep.pose.setState('idle');
      demoPeep.pose.update(time, dt);
      if (demoPeep.group.visible) {
        const wv = new t.Vector3(x, 0, dancing ? 0.06 : 0.02);
        group.localToWorld(wv);
        mark(-1, wv.x, wv.y, wv.z);
      }
    }
    // then the REAL sim guests, when a manager was attached
    const rows = mgr?.guests?.();
    if (rows)
      for (let i = 0; i < rows.length; i += 1) {
        const g = rows[i];
        if (g.hidden || g.gone) continue;
        mark(g.id, g.position[0], g.position[1], g.position[2]);
      }
    // the forced chord (a still) presses keys with nobody on them at all
    for (let i = 0; i < forced.length; i += 1) keys[forced[i]].hit = true;

    // ---- 6b. THE KEYS: press envelope, strike edge, hammer, colour ------
    // ATTACK is fast (0.09 s) so a step reads on the frame it lands; RELEASE is
    // slower (0.3 s) so a key falling back behind a walker still reads as a key.
    let down = 0;
    let deepest = 0;
    let held = 0;
    let anyStrike = 0;
    for (let i = 0; i < 12; i += 1) lampLevel[i] = Math.max(0, lampLevel[i] - dt / 0.75);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const rate = k.hit ? 1 / 0.09 : -1 / 0.3;
      k.press = clamp01(k.press + rate * dt);
      const nowDown = k.press > 0.5;
      if (nowDown && !k.down) {
        // ---- A NOTE SOUNDS ----
        k.strike = 1;
        state.notesPlayed += 1;
        state.lastNote = k.note;
        state.lastKey = i;
        state.lastPlayer = k.hitBy === -2 ? null : k.hitBy;
        lampLevel[k.cls] = 1;
        const fl = flares[flareNext % flares.length];
        flareNext += 1;
        fl.k = i;
        fl.age = 0;
      }
      k.down = nowDown;
      k.held = nowDown ? k.held + dt : 0;
      k.strike = Math.max(0, k.strike - dt / 0.45);
      if (nowDown) down += 1;
      deepest = Math.max(deepest, k.press);
      held = Math.max(held, k.held);
      anyStrike = Math.max(anyStrike, k.strike);

      // THE KEY ROTATES ABOUT ITS BACK EDGE, from tip-up at rest DOWN TO LEVEL
      // at full press, and settles a hair on its balance rail as it lands. The
      // stroke therefore ENDS on the surface the piano is set into instead of
      // continuing through it — see KEY_TRAVEL for why it runs this way round.
      const p = smooth(k.press);
      k.mesh.rotation.x = -(1 - p) * REST_TILT;
      k.mesh.position.y = PLATE_H - p * PRESS_SETTLE;
      // the HAMMER swings back off the rest toward the strings
      k.hammer.rotation.x = 0.3 - p * 0.85;

      // ---- COLOUR: the attract pattern UNDER the press ----
      // A still frame is never a dead grey slab: a glissando wave walks the run
      // (one key per half-beat), the whole board breathes on the beat, and every
      // fourth bar a hashed TRIAD flashes — all on ABSOLUTE time.
      const wIdx = k.black ? (k.x + halfW) / WHITE_PITCH : i + 0.5;
      const wave = ((time * 2.2) % (whites + 5)) - 2.5;
      const glis = Math.exp(-((wIdx - wave) ** 2) / 1.1);
      const bar = Math.floor(time * BEAT_HZ * 0.25);
      const chordRoot = Math.floor(hash01(bar * 3.7 + seed * 5.1) * Math.max(1, whites - 5));
      const inChord = !k.black && (i === chordRoot || i === chordRoot + 2 || i === chordRoot + 4);
      const chordK = inChord ? beatKick(time, -0.02) * (beatStep(time) % 4 === 0 ? 1 : 0.15) : 0;
      const attract = (0.1 + 0.5 * glis + 0.55 * chordK) * beatPulse(time, k.ph) * gain;
      // the STRIKE is a spike on top of the hold, so a held key still reads as
      // musical: it re-trills on the beat rather than sitting flat
      const trill = k.press > 0.5 ? 0.45 + 0.55 * beatKick(time, k.ph * 0.2) : 0;
      // COLOUR. The whole board shares ONE dominant palette colour per beat and
      // a PRESSED key blends to its own NOTE colour — the first cut gave every
      // key its own independently stepping hue and the keyboard rendered as a
      // pastel rainbow floor in which you could not tell a sharp from a natural,
      // let alone which key somebody was standing on.
      //
      // And white keys pull their emissive HALFWAY TO WHITE (Discotron's
      // mirror-ball trick): an ivory key lit by a magenta club is ivory
      // CATCHING magenta, not a magenta key. The pressed key drops that pull,
      // so the note colour lands full strength on exactly one key.
      tmpCol.setHex(paletteAt(beatStep(time))).lerp(k.tint, 0.35 + 0.65 * p);
      if (!k.black) tmpCol.lerp(WHITE, 0.55 * (1 - 0.75 * p));
      k.m.emissive.copy(tmpCol);
      // the pressed term is deliberately modest (it peaked at 4.2 in the first
      // night render and the key under the guest clipped to pure WHITE, losing
      // the note colour that is the whole point): it tops out near 2.0 with the
      // strike spike, which reads as a key blazing in its own colour.
      // the SHARPS take less attract than the naturals, not more: at 0.8 the
      // near-black gloss washed violet in daylight and the keyboard lost its
      // black-and-white read. `gain` (0.4 → 1.5 on nightK) carries them at night.
      k.m.emissiveIntensity = (k.black ? 0.45 : 0.42) * attract + p * (1.0 + 0.85 * nk) * (0.6 + 0.4 * trill) + k.strike * 0.7;
      // a pressed key also washes its own BODY toward the note colour, so the
      // key that is down is unmistakable in a still (and by day, where emissive
      // alone is only ~40 % of night's)
      k.m.color.copy(k.base).lerp(k.tint, (k.black ? 0.35 : 0.55) * p);
    }
    state.keysDown = down;
    state.players = players.size;
    state.deepest = deepest;
    state.held = held;
    state.zone = zoneOn;

    // ---- 6c. WHAT A NOTE DRIVES ----------------------------------------
    const noteCol = state.lastKey !== null ? paletteAt(keys[state.lastKey].cls) : paletteAt(beatStep(time));
    for (let c = 0; c < 12; c += 1) {
      const m = lampMats[c];
      const l = lampLevel[c];
      m.emissiveIntensity = 0.1 + gain * (0.25 * beatPulse(time, c * 0.08) + 2.2 * l);
      m.color.setHex(paletteAt(c));
    }
    barMat.color.setHex(paletteAt(beatStep(time)));
    barMat.emissive.setHex(paletteAt(beatStep(time)));
    barMat.emissiveIntensity = 0.18 + gain * 0.9 * beatPulse(time, 0.25);
    // the strings SHIMMER when the hammers hit them
    stringMat.emissive.setHex(noteCol);
    stringMat.emissiveIntensity = 0.06 + gain * (0.12 * beatPulse(time, 0.5) + 1.5 * anyStrike);
    // the note flares
    flares.forEach((fl) => {
      fl.age += dt;
      const a = 1 - fl.age / 0.5;
      if (a <= 0) {
        fl.mesh.visible = false;
        return;
      }
      const k = keys[fl.k];
      fl.mesh.visible = true;
      // flat on the struck key, spreading outward as it fades
      fl.mesh.position.set(k.x, KEY_SURFACE_Y + (k.black ? BLACK_RISE : 0) + 0.014 + (1 - a) * 0.02, k.black ? HINGE_Z + BLACK_LEN * 0.5 : 0.05);
      // sized to the KEY it sits on: a sharp is 0.185 × 0.8 and a natural
      // 0.29 × 1.3, and one bloom size for both left a wide patch hanging off
      // either side of every struck sharp (it read as a separate object in the
      // in-park close-up until it was traced back to exactly this)
      const wf = k.black ? 0.4 : 0.72;
      const lf = k.black ? 0.62 : 1;
      fl.mesh.scale.set(wf + (1 - a) * wf * 0.8, lf * (0.7 + (1 - a) * 0.55), 1);
    });
    flareMat.emissive.setHex(noteCol);
    // mostly a NIGHT effect: at full daylight opacity a soft flare still read as
    // a pale card in the harness, and by day the key's own colour wash carries it
    flareMat.opacity = (0.06 + 0.5 * nk) * clamp01(0.35 + anyStrike + deepest * 0.4);
    flareMat.emissiveIntensity = 0.3 + 1.5 * nk;
    // the bloom plate over the keys
    bloomMat.emissive.setHex(noteCol);
    bloomMat.emissiveIntensity = 0.3 + 1.5 * nk * beatPulse(time, 0.1);
    bloomMat.opacity = 0.015 + 0.1 * nk * beatPulse(time, 0.1) + 0.06 * clamp01(deepest);
    // the two house lights: on the beat, and hot on a strike
    houseLights.forEach((pl, i) => {
      pl.color.setHex(noteCol);
      pl.intensity = (0.22 + 1.5 * nk) * (0.75 + 0.25 * beatPulse(time, i * 0.5)) + 0.8 * anyStrike;
    });
    sign.update(time);
  };

  // the fleet's live-state accessor convention (the behaviour harness finds the
  // rig with `pianoRef` and needs `pianoKeys` to know WHICH key a press is)
  group.userData.pianoRef = () => ({ ...state, press: keys.map((k) => k.press) });
  group.userData.pianoKeys = () => keys.map((k) => ({ x: k.x, black: k.black, note: k.note }));
  return {
    group,
    update,
    state: () => ({ ...state }),
    press: () => keys.map((k) => k.press),
    keyInfo: () => keys.map((k) => ({ x: k.x, black: k.black, note: k.note })),
    half: [halfW + 0.08, WHITE_LEN / 2 + 0.07],
    attach: (m, z) => {
      mgr = m;
      zoneOn = z;
    },
  };
}

/** Preview STAGING: the piano with its demo player walking the keys. For
 *  previews only — inside a real <Park> compose `<BigPiano>` (the demo player
 *  defaults OFF there; real guests play it). */
export function buildBigPianoScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const built = buildBigPiano(three, { demo: true });
  return { group: built.group, update: built.update };
}

// ---------------------------------------------------------------------------
// the composable + its UI window
// ---------------------------------------------------------------------------

export interface BigPianoProps extends BigPianoOpts {
  /** inside a real <Park>: attach the GameManager so the keys can SEE the guests
   *  walking over them (default true; read-only — the piano never writes to the
   *  sim). */
  register?: boolean;
  /** register a GameManager WATCH ZONE over the keybed so guests STOP on the
   *  keys and turn to face the case for a hashed 5-11 s instead of only walking
   *  across (default true).
   *
   *  It is deliberately a WATCH zone and not a dance zone: a dance dwell is
   *  10-30 s and 'dance' is an ACTION taken while the state is still 'walking',
   *  which trips validatePark's "stood still > 25 sim-s while walking" gate on
   *  its own — at cooldown 0 AND at cooldown 30. 'watching' is a stationary
   *  STATE the stuck detector resets on. Set false for a pure-scenery piano. */
  linger?: boolean;
  /** how long a latched guest plays, in seconds (default `[5, 11]`) */
  lingerFor?: [number, number];
  /** FLUSH-MOUNT the keybed into the walked surface (default true, real
   *  `<Park>` only). `useComposable` settles every composable onto
   *  `park.floorAt(x, z)` — the TERRAIN — but `<Paths>` renders a 0.09 u slab on
   *  top of that terrain and guests walk on the slab, so a piano settled on the
   *  terrain has its 0.083 u of key BURIED: the first real-park render showed
   *  bare grey paving where the keyboard should have been, with only the case
   *  and the hammers above the kerb.
   *
   *  With `flush` the compose hook lifts the rig by
   *  `walkYAt(x, z) + PRESS_CLEAR·scale − KEY_SURFACE_Y·scale − settledY`, which
   *  lands a fully PRESSED natural 20 mm proud of the paving (a pressed sharp
   *  40 mm) and puts a real guest's feet ON the key they are standing on instead
   *  of ankle-deep in it — the way a floor piano is actually installed.
   *
   *  A key at REST rests higher still: its tip is up by `KEY_TRAVEL` and comes
   *  DOWN to the paving as it is pressed (see KEY_TRAVEL). That is deliberate,
   *  and it is what stops a pressed key sinking through the ground — measured in
   *  a real park, the previous level-at-rest key put its top face 51.7 mm UNDER
   *  the plaza slab at full press.
   *
   *  Set false to stand the piano on open ground with its own plinth showing. */
  flush?: boolean;
  /** also register the CASE as a guest blocker (default false). The keybed is
   *  NEVER blocked — it is the walking surface. Off by default because a
   *  blocker beside a street is what validatePark's `blockers` gate fails on. */
  blocking?: boolean;
  /** internal: hands the mounted rig to the window layer */
  bind?: (h: BigPianoHandle | null) => void;
}

const BigPianoBase = composable<BigPianoProps, BigPianoBuilt>(
  'BigPiano',
  (t, props, park) => {
    const preview = (park as unknown as { _previewHost?: boolean })._previewHost === true;
    const built = buildBigPiano(t, {
      count: props.count,
      seed: props.seed,
      chord: props.chord,
      // decorative demo player: on under a preview host, off in a real park
      demo: props.demo ?? preview,
    });
    props.bind?.({ api: park.api, group: built.group, state: built.state });
    const prevDispose = built.dispose;
    built.dispose = () => {
      prevDispose?.();
      props.bind?.(null);
    };
    return built;
  },
  {
    compose: (park: ParkContextValue, { built, props, position, rotation, scale }) => {
      const cleanups: (() => void)[] = [];
      // FLUSH-MOUNT: settle the NATURALS level with the walked surface, not the
      // terrain under it (see the `flush` prop — this is the fix for a keyboard
      // that rendered as bare paving in its first real park).
      if (props.flush ?? true) {
        const paths = (park as unknown as { paths?: { pathY: number; walkYAt?: (x: number, z: number) => number } }).paths;
        // no <Paths> = no walked surface to be flush WITH: leave the piano
        // standing on its own keybed rather than sinking it 0.069 u into the turf
        const walkY = paths ? paths.walkYAt?.(position[0], position[2]) ?? paths.pathY + 0.09 : position[1] + KEY_SURFACE_Y * scale;
        // …and PRESS_CLEAR PROUD of it, not exactly level: at exactly level the
        // naturals are coplanar with the path slab and the paving simply won —
        // the second real-park render showed the sharps standing on bare grey
        // stone with no white keys at all. And because the stroke now ENDS at
        // KEY_SURFACE_Y (a fully pressed key is level), this clearance is
        // literally the margin a pressed key keeps over the ground: it has to
        // stay ahead of the ~6 mm by which a <PathNetwork> PLAZA top overshoots
        // the walkYAt sampled here.
        const lift = walkY + PRESS_CLEAR * scale - KEY_SURFACE_Y * scale - position[1];
        // never sink the case below its own base rail, never lift it off the ground
        built.group.position.y += Math.max(-KEY_SURFACE_Y * scale, Math.min(0.6, lift));
      }
      // THE PLANTED FOOTPRINT IS THE CASE, NOT THE KEYBED. The keys are meant to
      // be laid across a walked surface, and `validatePark`'s planted-scenery
      // gate fails a footprint that intrudes into a path slab — so what is
      // registered is the solid body BEHIND the keys (local −z), which is the
      // piano's real ground contact anyway.
      const cx = position[0] - Math.sin(rotation) * -CASE_CZ * scale;
      const cz = position[2] - Math.cos(rotation) * -CASE_CZ * scale;
      park.registerPlanted?.({ label: '<BigPiano> case', x: cx, z: cz, r: 0.42 * scale });
      let mgr: PianoMgr | null = null;
      let zone = false;
      if (props.register ?? true) mgr = park.manager() as PianoMgr;
      if ((props.linger ?? true) && mgr) {
        // THE PLAY ZONE = the keybed itself, so a guest who steps onto the keys
        // is the guest who stops on them. `faceAt` is the CASE, so a latched
        // guest turns and looks at the piano (and at the marquee) rather than
        // standing side-on to it.
        if (mgr.registerWatchZone) {
          mgr.registerWatchZone({
            center: [position[0], position[2]],
            halfW: built.half[0] * scale,
            halfD: built.half[1] * scale,
            rotation,
            faceAt: [cx, cz],
            // a TUNE, not a residency — and the manager's 30 s per-guest
            // cooldown is what keeps the street flowing over the keys
            linger: props.lingerFor ?? [5, 11],
          });
          zone = true;
        } else {
          console.warn(
            '[BigPiano] linger: this GameManager exposes no registerWatchZone — the keys still light for guests walking over them, but nothing makes them STOP and play (components/BigPiano/Context.md)',
          );
        }
      }
      if (props.blocking) {
        const un = park.registerBlocker?.({
          rect: { cx, cz, hx: (built.half[0] + 0.06) * scale, hz: 0.42 * scale, yaw: rotation },
          label: '<BigPiano> case',
          kind: 'scenery',
          height: 1.6 * scale,
        });
        if (un) cleanups.push(un);
      }
      built.attach(mgr, zone);
      return cleanups.length ? () => cleanups.forEach((c) => c()) : undefined;
    },
  },
);

/** the window's own row helper — RCT2 chrome */
function Row({ label, value, tint }: { label: string; value: React.ReactNode; tint?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '1px 0' }}>
      <span style={UI_TEXT.name}>{label}</span>
      <span style={{ ...UI_TEXT.value, ...(tint ? { color: tint, fontWeight: 700 } : null) }}>{value}</span>
    </div>
  );
}

/** a small bar in the RCT2 inset-panel style (the GuestInfo stat-bar look) */
function Bar({ k, color }: { k: number; color: string }) {
  return (
    <div style={{ height: 7, background: '#8E8674', outline: '1px solid #3A3226', margin: '2px 0 4px' }}>
      <div style={{ height: '100%', width: `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`, background: color }} />
    </div>
  );
}

/**
 * <BigPiano> — the Pulse District's oversized WALK-ON keyboard, as a composable
 * SCENERY component (components/Park/Context.md): mounts at
 * `position`/`rotation`/`scale` inside a `<Park>` or a `<ScenePreview>`. It is
 * NOT a ride — no queue, no station, no hut, no FSM, no ride `register` wiring.
 *
 * Lay the KEY RUN (local x) along the street: guests then cross key after key,
 * each one depressing, lighting and sounding a note under their feet. Inside a
 * real `<Park>` it registers a GameManager WATCH ZONE over the keybed so guests
 * stop and play (`linger`, ON by default), reads their positions out of the
 * GameManager to resolve which key is under whom, and opens a themed window
 * when clicked through the shared `userData.pickRef` Stage pick path.
 */
export const BigPiano: React.FC<BigPianoProps & ComposableProps> = (props) => {
  const [handle, setHandle] = useState<BigPianoHandle | null>(null);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  // CLICK → the window, through the SHARED Stage pick path: tagging the root
  // group with `userData.pickRef` is the whole wiring (<Park>'s onPick calls it;
  // the api.onPick subscription covers a bare <ScenePreview> with no <Park>).
  useEffect(() => {
    if (!handle) return;
    const openIt = () => setOpen(true);
    handle.group.userData.pickRef = openIt;
    const un = handle.api.onPick?.((obj) => {
      if (obj === handle.group) openIt();
    });
    return () => {
      un?.();
      if (handle.group.userData.pickRef === openIt) delete handle.group.userData.pickRef;
    };
  }, [handle]);

  // poll the live state while the window is open (rules/ui.md: ≥ 250 ms)
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [open]);

  const target = handle
    ? handle.api.renderer.domElement.parentElement?.parentElement ?? handle.api.renderer.domElement.parentElement ?? null
    : null;
  const st = open && handle ? handle.state() : null;

  return (
    <>
      <BigPianoBase {...props} bind={setHandle} />
      {open && st && target
        ? createPortal(
            <UIWindow title="The Big Piano" x={10} y={10} width={224} onClose={() => setOpen(false)}>
              <div style={{ ...UI_TEXT.header, marginTop: 1 }}>The keyboard</div>
              <Row
                label={st.keysDown > 0 ? 'Being played' : 'Attract mode'}
                value={st.keysDown > 0 ? `${st.keysDown} key${st.keysDown === 1 ? '' : 's'} down` : 'nobody on it'}
                tint={st.keysDown > 0 ? '#8E1A78' : undefined}
              />
              <Bar k={st.deepest} color="#C43BAE" />
              <Row label="Notes played" value={st.notesPlayed} />
              <Row label="On the keys" value={st.players} />
              <div style={{ ...UI_TEXT.header, marginTop: 4 }}>Last note</div>
              {st.lastNote === null ? (
                <div style={{ ...UI_TEXT.value, fontStyle: 'italic' }}>Nobody has stepped on it yet.</div>
              ) : (
                <>
                  <Row label="Note" value={st.lastNote} tint="#155F6B" />
                  <Row label="Played by" value={st.lastPlayer === null ? '—' : st.lastPlayer < 0 ? 'A show-off' : `Guest ${st.lastPlayer + 1}`} />
                  <Row label="Held" value={`${st.held.toFixed(1)} s`} />
                </>
              )}
              <div style={{ ...UI_TEXT.header, marginTop: 4 }}>How it plays</div>
              <div style={{ ...UI_TEXT.value, lineHeight: 1.35 }}>
                {st.zone
                  ? 'A watch zone is registered: guests who step onto the keys stop to play, then walk on.'
                  : 'Every key lights for whoever walks over it, and falls back behind them.'}
              </div>
            </UIWindow>,
            target,
          )
        : null}
    </>
  );
};
BigPiano.displayName = 'BigPiano';

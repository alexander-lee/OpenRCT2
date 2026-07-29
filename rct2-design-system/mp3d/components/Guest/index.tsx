import React from 'react';
import * as THREE from 'three';
import { box, ball, cyl } from '../Stage';
import { composable } from '../Park';

// Shared peep builder — used by the Guest crowd and seated in rides. Supports
// varied skin tones, hair, shirt/trousers colours, a FEMALE variant (shoulder-
// length hair + ponytail, skirt over bare legs — same heights and pivots) and
// facial EXPRESSIONS (happy / neutral / sad / surprised). The face is
// TEXTURE-BASED: eyes, brows and mouth are painted onto a cached CanvasTexture
// wrapped on the head sphere (one canvas per skin+expression) — no 3D face
// meshes. Limbs pivot for a walk cycle or sit; the arm and leg pivots are
// returned as armL/armR/legL/legR so callers can pose limbs (waves, hands-in-
// the-air dancing, squats), and setSick(on) swaps the face for a green-tinted
// grimacing SICK variant (its own texture-cache key) and back.
//
// ATTACHMENT SLOTS: three, all returned. The two HANDS are the arm pivots
// (hand ball at arm-local [0, -0.32, 0]) — the GameManager parents held food /
// drink / balloons there — and `headSlot` is the HEAD anchor on the crown for
// WEARABLES (hats, goggles): see its comment in buildPeep for the frame.
//
// ANIMATION lives in the returned `pose` controller (see PeepPose below): a
// small per-peep state machine (idle / walk / dance / jump) that OWNS the limb
// rotations and CROSSFADES every transition — no snapping. `walk(time, phase)`
// is kept as a thin backwards-compatible wrapper that drives the controller.
export type Expression = 'happy' | 'neutral' | 'sad' | 'surprised';
export interface PeepOpts {
  shirt?: number;
  trousers?: number;
  skin?: number;
  hair?: number;
  expression?: Expression;
  seated?: boolean;
  /** female variant: shoulder-length hair + ponytail, and a skirt over bare legs */
  female?: boolean;
}
export const SKIN_TONES = [0xf1c9a5, 0xe0a878, 0xc68642, 0x8d5524, 0x5c3a21];
export const SHIRTS = [0xc21a1a, 0x2f6fd0, 0x2e9e54, 0xe0a020, 0x8e44ad, 0xe06010, 0x18a0a0, 0xe060a0];
export const TROUSERS = [0x26305e, 0x3a2a1a, 0x333940, 0x5a3d22, 0x6a1030];
export const HAIRS = [0x4a3018, 0x1c1c1c, 0x7a5230, 0xb08040];

// ---------------------------------------------------------------------------
// Pose layer — the peep animation controller.
//
//   pose.setState('idle' | 'walk' | 'dance' | 'jump', speed?)
//   pose.update(time, dt?)
//
// - Every state switch CROSSFADES (~0.25 s ease-in-out): the current limb
//   angles are snapshotted and interpolated onto the new state's curve, and a
//   global per-channel slew limit (< 0.15 rad per 60 fps frame on limbs)
//   guarantees continuity even across huge pose jumps (arms-up dancing).
// - 'walk' runs on a PHASE ACCUMULATOR (phase += speed·dt, speed in rad/s) so
//   speed changes are smooth and stopping eases the limbs home. Swing
//   amplitude scales with cadence — slow shuffles take small steps.
// - 'jump' is a one-shot: anticipation crouch (0.12 s) → parabolic flight with
//   tucked legs and rising arms → landing compression → recovery, then it
//   AUTO-RETURNS to the previous state (setState during a jump only retargets
//   the return state; `speed` scales the jump height).
// - 'dance' sequences beat-synced moves (bounce / twist / sway / spin /
//   arm-wave / side-step shuffle) from a per-style playlist, crossfading each
//   segment; `speed` is the beat in Hz (default 2.2), `setDanceStyle(0..3)`
//   picks the playlist, `pose.seed` varies it per peep.
// - The female skirt hangs from its own pivot and SWINGS: a damped spring
//   chases the body's world-yaw changes (turns and spins swirl it) and it
//   FLARES (x/z scale pulse) on fast spins and hops.
// - Channel ownership: pose writes leg/arm rotations, group roll (rotation.z),
//   group bob (position.y), head bob (position.y) and head pitch (rotation.x —
//   mirrored on `pose.headNod` for callers that overwrite it). It NEVER writes
//   group yaw — dance spins are exposed as `pose.spinYaw` for the caller to
//   add (`group.rotation.y = yaw + pose.spinYaw`). Overrides (lap bars,
//   eat/drink arm cycles, raised-arm choreography) compose ON TOP: apply them
//   AFTER pose.update and the next crossfade picks up from wherever they left
//   the limbs. Deterministic: pass an explicit dt (or a monotonic time) —
//   hashed-sine variation only, no Math.random.
// ---------------------------------------------------------------------------
export type PoseState = 'idle' | 'walk' | 'dance' | 'jump';
export interface PeepPose {
  /** current state ('jump' until its arc completes, then the return state) */
  readonly state: PoseState;
  /** per-peep variation seed for idle fidgets and dance playlists */
  seed: number;
  /** dance spin offset — ADD to your own group yaw (0 outside spins) */
  readonly spinYaw: number;
  /** head pitch the pose wrote this frame — re-add it if you overwrite head.rotation.x */
  readonly headNod: number;
  setState(s: PoseState, speed?: number): void;
  /** dance playlist 0 bounce / 1 twist / 2 sway / 3 spin-burst */
  setDanceStyle(style: number): void;
  update(time: number, dt?: number): void;
}

/**
 * Walk cadence (phase rad/s for pose 'walk') that matches a real ground speed
 * so feet never skate: solves speed = strideLength(amplitude(cadence)) ×
 * cadence/2π for the pose gait (leg 0.4 long, ±0.5 rad × amplitude swing,
 * two steps per 2π). `scale` is the peep's world scale (crowds use 0.5).
 */
export function cadenceForSpeed(speed: number, scale = 1): number {
  if (speed <= 1e-4) return 0;
  let w = 8;
  for (let i = 0; i < 8; i += 1) {
    const amp = Math.min(1, w / 4) ** 0.8;
    const stride = 1.6 * Math.sin(0.5 * amp) * scale; // ground covered per 2π of phase
    w = w * 0.5 + Math.min((Math.PI * 2 * speed) / Math.max(stride, 1e-4), 13) * 0.5;
  }
  return Math.min(w, 13);
}

// deterministic pseudo-random from a float key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (u: number) => {
  const v = Math.max(0, Math.min(1, u));
  return v * v * (3 - 2 * v);
};
const TAU = Math.PI * 2;
const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);

// pose channels
const LGL = 0; // legL.rotation.x
const LGR = 1; // legR.rotation.x
const AXL = 2; // armL.rotation.x
const AXR = 3; // armR.rotation.x
const AZL = 4; // armL.rotation.z
const AZR = 5; // armR.rotation.z
const ROLL = 6; // group.rotation.z (hip sway / lean)
const BOB = 7; // group.position.y
const HBOB = 8; // head.position.y offset (counter-bob)
const HRX = 9; // head.rotation.x (nod)
const SPIN = 10; // dance spin yaw offset
const NCH = 11;
// per-channel slew limits (units/s). Limbs stay under 8.5 rad/s = 0.142 rad
// per 60 fps frame — the continuity guarantee across any state switch.
const RATE = [8.5, 8.5, 8.5, 8.5, 6, 6, 2.5, 3.5, 2, 5, 14];
const XFADE = 0.25; // s — state / dance-move crossfade
const JUMP_ANT = 0.12; // anticipation crouch
const JUMP_FLY = 0.42; // parabolic flight
const JUMP_LAND = 0.16; // landing compression + recovery
const JUMP_T = JUMP_ANT + JUMP_FLY + JUMP_LAND;
const SEG = Math.PI * 8; // dance segment: 4 beats of 2π
// dance-move playlists per style: 0 bounce, 1 twist, 2 sway, 3 spin, 4 arm-wave, 5 shuffle
const PLAYLISTS = [
  [0, 4, 0, 5], // bounce style
  [1, 5, 1, 4], // twist style
  [2, 4, 2, 5], // sway style
  [0, 3, 4, 3], // spin-burst style
];

// shared scratch for skirt world-yaw tracking (single-threaded)
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// ---------------------------------------------------------------------------
// Texture-based face: paint the whole face (eyes, pupils, brows, mouth) onto a
// canvas that wraps the head sphere. Sphere UV facts (r = 0.12, default
// SphereGeometry): the head's +z front sits at u = 0.25, so the face is drawn
// around canvas x = 0.25·S; 1 radian ≈ S/2π px horizontally and S/π px
// vertically (a round eye on the sphere is a 1:2 ellipse on canvas). Feature
// rows come from theta = acos(y / r) at the old mesh heights, so the painted
// face lands exactly where the 3D features used to be.
// ---------------------------------------------------------------------------
// `sick` variant (its own cache key): green-tinted skin, worried brows and a
// wavy grimace mouth — swapped onto the head via buildPeep's setSick(on).
const _faceCache = new Map<string, THREE.CanvasTexture>();
function faceTexture(t: typeof THREE, skin: number, expr: Expression, sick = false) {
  const key = `${skin}:${expr}${sick ? ':s' : ''}`;
  const hit = _faceCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  let bg = skin;
  if (sick) {
    // blend the skin ~45% toward a queasy green
    const mix = (a: number, b: number) => Math.round(a + (b - a) * 0.45);
    bg = (mix((skin >> 16) & 255, 134) << 16) | (mix((skin >> 8) & 255, 176) << 8) | mix(skin & 255, 106);
  }
  x.fillStyle = hex(bg);
  x.fillRect(0, 0, S, S);

  const cx = 0.25 * S; // face centre column (+z on the sphere)
  const px = S / (2 * Math.PI); // px per radian, horizontal
  const py = S / Math.PI; // px per radian, vertical
  const row = (y: number) => (Math.acos(Math.max(-1, Math.min(1, y / 0.12))) / Math.PI) * S;
  const wide = expr === 'surprised';

  // eyes: white + pupil + highlight (angular radii from the old mesh sizes)
  const eyeY = row(0.02);
  const eyeDX = 0.42 * px; // ±0.048 at z≈0.11 → ±0.42 rad off centre
  const eyeR = (wide ? 0.034 : 0.028) / 0.12;
  const pupR = (wide ? 0.019 : 0.017) / 0.12;
  [-1, 1].forEach((s) => {
    const ex = cx + s * eyeDX;
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.ellipse(ex, eyeY, eyeR * px, eyeR * py, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#14141a';
    x.beginPath();
    x.ellipse(ex, eyeY + (wide ? 0 : 1), pupR * px, pupR * py, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.85)'; // catchlight
    x.beginPath();
    x.ellipse(ex - pupR * px * 0.3, eyeY - pupR * py * 0.35, pupR * px * 0.28, pupR * py * 0.28, 0, 0, Math.PI * 2);
    x.fill();
  });

  // brows: dark strokes; sad (and sick) tilts inner ends UP, others out-down
  const worried = sick || expr === 'sad';
  const browY = row(worried ? 0.052 : 0.065);
  const browHalf = 0.23 * px; // 0.055-wide bar → ±0.23 rad
  x.strokeStyle = '#2a1c10';
  x.lineWidth = 0.1 * py * 0.55;
  x.lineCap = 'round';
  [-1, 1].forEach((s) => {
    const ex = cx + s * eyeDX;
    const tilt = (worried ? -0.35 : 0.15) * s; // canvas y is down
    x.beginPath();
    x.moveTo(ex - browHalf, browY + Math.tan(tilt) * browHalf);
    x.lineTo(ex + browHalf, browY - Math.tan(tilt) * browHalf);
    x.stroke();
  });

  // mouth by expression
  x.strokeStyle = '#1a1207';
  x.fillStyle = '#1a1207';
  x.lineWidth = 0.067 * py * 0.6;
  if (sick) {
    // grimace: a wavy clenched line, cheeks washed queasy green
    const my = row(-0.045);
    x.beginPath();
    for (let k = 0; k <= 10; k += 1) {
      const mx = cx - 0.27 * px + (k / 10) * 0.54 * px;
      const wy = my + Math.sin(k * Math.PI * 0.8) * 0.045 * py * 0.28;
      if (k === 0) x.moveTo(mx, wy);
      else x.lineTo(mx, wy);
    }
    x.stroke();
    x.fillStyle = 'rgba(110,160,90,0.3)';
    [-1, 1].forEach((s) => {
      x.beginPath();
      x.ellipse(cx + s * (eyeDX + 0.16 * px), row(-0.015), 0.11 * px, 0.11 * py * 0.6, 0, 0, Math.PI * 2);
      x.fill();
    });
  } else if (expr === 'surprised') {
    const my = row(-0.04);
    x.beginPath();
    x.ellipse(cx, my, (0.028 / 0.12) * px, (0.028 / 0.12) * py, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#5a1f1f'; // open-mouth inner
    x.beginPath();
    x.ellipse(cx, my + 1, (0.02 / 0.12) * px, (0.02 / 0.12) * py, 0, 0, Math.PI * 2);
    x.fill();
  } else if (expr === 'neutral') {
    const my = row(-0.045);
    x.beginPath();
    x.moveTo(cx - 0.25 * px, my);
    x.lineTo(cx + 0.25 * px, my);
    x.stroke();
  } else {
    // happy smile (lower arc) / sad frown (upper arc, lower on the face)
    const my = row(expr === 'sad' ? -0.055 : -0.03);
    const mr = 0.029 / 0.12;
    x.beginPath();
    if (expr === 'sad') x.ellipse(cx, my + mr * py * 0.5, mr * px, mr * py, 0, Math.PI * 1.15, Math.PI * 1.85);
    else x.ellipse(cx, my - mr * py * 0.25, mr * px, mr * py, 0, Math.PI * 0.15, Math.PI * 0.85);
    x.stroke();
    if (expr === 'happy') {
      // faint cheek blush
      x.fillStyle = 'rgba(220,110,90,0.28)';
      [-1, 1].forEach((s) => {
        x.beginPath();
        x.ellipse(cx + s * (eyeDX + 0.16 * px), row(-0.015), 0.11 * px, 0.11 * py * 0.6, 0, 0, Math.PI * 2);
        x.fill();
      });
    }
  }

  const tex = new t.CanvasTexture(c);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _faceCache.set(key, tex);
  return tex;
}

export function buildPeep(t: typeof THREE, o: PeepOpts = {}) {
  const SKIN = o.skin ?? 0xe0a878;
  const HAIR = o.hair ?? 0x4a3018;
  const SHIRT = o.shirt ?? 0xc21a1a;
  const TROU = o.trousers ?? 0x26305e;
  const SHOE = 0x2a1c10;
  const expr = o.expression ?? 'happy';

  const grp = new t.Group();
  let skirt: THREE.Group | null = null;
  if (o.female) {
    // SKIRT — a frustum (rTop < rBottom) in the trousers colour at the same
    // hip height as the male hip box, hung from its OWN pivot so the pose
    // layer can swing it (damped follow of body-yaw changes) and flare it
    // (x/z scale pulse) on spins and hops. Legs keep their identical pivots
    // underneath and the skirt simply flares over folded legs when seated.
    skirt = new t.Group();
    skirt.position.set(0, 0.49, 0);
    skirt.add(cyl(t, 0.13, 0.2, 0.22, TROU, [0, 0, 0], { tex: 'fabric', repeat: [3, 1], rough: 0.9 }));
    grp.add(skirt);
  } else {
    grp.add(box(t, [0.26, 0.14, 0.18], TROU, [0, 0.52, 0], { tex: 'fabric', repeat: [2, 1], rough: 0.9 }));
  }
  grp.add(box(t, [0.3, 0.32, 0.2], SHIRT, [0, 0.74, 0], { tex: 'fabric', repeat: [2, 2], rough: 0.85 }));

  const HEAD_Y = 0.99;
  const head = new t.Group();
  head.position.set(0, HEAD_Y, 0);
  // head sphere with the PAINTED face (eyes/brows/mouth live in the texture)
  const skull = new t.Mesh(
    new t.SphereGeometry(0.12, 28, 20),
    new t.MeshStandardMaterial({ map: faceTexture(t, SKIN, expr), roughness: 0.7 }),
  );
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);
  const hair = ball(t, 0.128, HAIR, [0, 0.04, -0.012], { rough: 0.9 });
  hair.scale.set(1.02, 0.72, 1.02);
  head.add(hair);
  if (o.female) {
    // shoulder-length back hair: a squashed ball draping down the back of the
    // head, plus a small ponytail ball — both ride the head group so head
    // turns and nods carry the hair.
    const back = ball(t, 0.11, HAIR, [0, -0.035, -0.07], { rough: 0.9 });
    back.scale.set(0.95, 1.25, 0.7);
    head.add(back);
    head.add(ball(t, 0.045, HAIR, [0, -0.02, -0.145], { rough: 0.9 }));
  }
  head.add(ball(t, 0.018, SKIN, [0, -0.005, 0.12], { rough: 0.6 })); // nose stays 3D for profile depth
  // ---- HEAD ATTACHMENT ANCHOR (`headSlot`) ---------------------------------
  // The third attachment slot alongside the two hands (armL/armR, whose hand
  // ball sits at arm-local [0, -0.32, 0]): WEARABLES — hats, goggles, ears —
  // parent HERE, so they ride every nod, mood tilt and head bob for free.
  // Frame: the anchor sits on the CROWN of the skull (head-local y +0.10; the
  // skull is r 0.12 and the hair cap tops out at ~0.132, so an item resting
  // near y 0 hugs the hair instead of floating), +z is the FACE direction
  // (the nose is at z 0.12) and units are PEEP-LOCAL — the park's 0.5
  // GUEST_SCALE on the root group scales a wearable automatically, so a
  // builder works out its sizes against the head radius 0.12 and never has to
  // know the world scale. A brow-line item (goggles) offsets itself DOWN and
  // FORWARD from here, e.g. position (0, -0.055, 0.03).
  const headSlot = new t.Group();
  headSlot.position.set(0, 0.1, 0);
  headSlot.name = 'headSlot';
  head.add(headSlot);
  grp.add(head);

  const limb = (px: number, py: number, col: number, len: number, hand?: number, texd?: boolean) => {
    const pivot = new t.Group();
    pivot.position.set(px, py, 0);
    pivot.add(box(t, [0.09, len, 0.11], col, [0, -len / 2, 0], texd ? { tex: 'fabric', repeat: [1, 2], rough: 0.85 } : { rough: 0.7 }));
    if (hand != null) pivot.add(ball(t, 0.05, hand, [0, -len, 0], { rough: 0.7 }));
    grp.add(pivot);
    return pivot;
  };
  const armL = limb(-0.19, 0.88, SHIRT, 0.32, SKIN, true);
  const armR = limb(0.19, 0.88, SHIRT, 0.32, SKIN, true);
  // female: bare skin-tinted legs under the skirt; same pivots/lengths either way
  const LEG = o.female ? SKIN : TROU;
  const legL = limb(-0.08, 0.46, LEG, 0.4, undefined, !o.female);
  const legR = limb(0.08, 0.46, LEG, 0.4, undefined, !o.female);
  legL.add(box(t, [0.12, 0.07, 0.2], SHOE, [0, -0.425, 0.03], { rough: 0.6 }));
  legR.add(box(t, [0.12, 0.07, 0.2], SHOE, [0, -0.425, 0.03], { rough: 0.6 }));

  if (o.seated) {
    legL.rotation.x = -1.5;
    legR.rotation.x = -1.5;
    armL.rotation.x = -1.1;
    armR.rotation.x = -1.1;
    if (expr === 'surprised') {
      armL.rotation.x = -2.6; // arms up!
      armR.rotation.x = -2.6;
    }
  }

  // ---- pose controller ------------------------------------------------------
  const target = new Float64Array(NCH);
  const snap = new Float64Array(NCH);
  const applied = new Float64Array(NCH);
  // start the blend from wherever the limbs are (matters for seated peeps)
  applied[LGL] = legL.rotation.x;
  applied[LGR] = legR.rotation.x;
  applied[AXL] = armL.rotation.x;
  applied[AXR] = armR.rotation.x;
  snap.set(applied);

  let state: PoseState = 'idle';
  let returnState: PoseState = 'idle'; // where a jump lands back
  let w = 1; // crossfade weight 0→1
  let phase = 0; // walk-phase accumulator (rad)
  let speedTarget = 0; // requested walk cadence (rad/s)
  let speedSm = 0; // smoothed cadence actually driving the gait
  let beat = 0; // dance beat phase (rad; 2π per beat) — always accumulates so crowds stay in sync
  let beatHz = 2.2;
  let style = 0;
  let lastSeg = -1;
  let jumpT = 0;
  let jumpAmp = 1;
  let now = 0;
  let lastTime: number | null = null;
  // skirt spring
  let skirtAng = 0;
  let skirtVel = 0;
  let flare = 0;
  let lastYaw: number | null = null;
  let lastBob = 0;

  // crossfade restart: the new state's curve is blended in FROM the pose's
  // current limb angles (callers layering their own arm overrides on top are
  // expected to ease them in/out themselves — see GameManager's lap-bar and
  // eat/drink envelopes — so the pose's own trajectory stays clean)
  const retarget = () => {
    snap.set(applied);
    w = 0;
  };

  const idleTargets = (T: Float64Array, n: number, seed: number) => {
    const br = Math.sin(n * 1.7 + seed); // ~0.27 Hz breathing
    const ws = Math.sin(n * 0.42 + seed * 1.3); // slow weight shift
    T[LGL] = 0.035 * ws;
    T[LGR] = -0.028 * ws;
    T[AXL] = -0.045 + 0.02 * br;
    T[AXR] = -0.045 + 0.02 * Math.sin(n * 1.7 + seed + 2.4);
    T[AZL] = 0.05 + 0.012 * ws;
    T[AZR] = -0.05 + 0.012 * ws;
    T[ROLL] = 0.022 * Math.sin(n * 0.42 + seed * 1.3 + 1.2);
    T[BOB] = 0.004 + 0.004 * br;
    T[HBOB] = 0.003 * Math.sin(n * 1.7 + seed + 0.9);
    T[HRX] = 0.015 * br;
    T[SPIN] = 0;
  };

  const walkTargets = (T: Float64Array, ph: number, amp: number) => {
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const knee = Math.sin(ph * 2) * 0.05 * amp; // slight knee-phase offset feel
    T[LGL] = 0.5 * s * amp + knee;
    T[LGR] = -0.5 * s * amp + knee;
    T[AXL] = -0.45 * s * amp;
    T[AXR] = 0.45 * s * amp;
    T[AZL] = 0.045 + 0.05 * c * amp; // counter-rotating shoulders: z micro-sway
    T[AZR] = -0.045 + 0.05 * c * amp;
    T[ROLL] = 0.03 * s * amp; // gentle hip sway onto the stance foot
    T[BOB] = Math.abs(c) * 0.032 * amp; // vertical bob at 2× — synced to footfalls
    T[HBOB] = -T[BOB] * 0.35; // head stays steadier than the body
    T[HRX] = 0;
    T[SPIN] = 0;
  };

  const danceTargets = (T: Float64Array, b: number, seed: number) => {
    const seg = Math.floor(b / SEG);
    if (seg !== lastSeg) {
      lastSeg = seg;
      retarget(); // crossfade between dance moves
    }
    let move = PLAYLISTS[((style % 4) + 4) % 4][((seg % 4) + 4) % 4];
    if (move !== 3 && hash01(seed * 7.7 + seg * 13.1) < 0.15) move = 3; // occasional full spin, any style
    const sb = Math.sin(b);
    const hop = Math.abs(sb);
    T[SPIN] = 0;
    T[HBOB] = 0;
    if (move === 0) {
      // BOUNCE — hops with knee give on landing, both hands in the air
      T[BOB] = hop * hop * 0.11;
      T[LGL] = T[LGR] = (1 - hop) * 0.22;
      T[AXL] = T[AXR] = -2.6;
      T[AZL] = 0.25 * sb;
      T[AZR] = -0.25 * sb;
      T[ROLL] = 0;
      T[HBOB] = -0.02 * hop;
      T[HRX] = 0.05 * Math.sin(b * 2);
    } else if (move === 1) {
      // TWIST — yaw wiggle (spinYaw), both raised arms swaying together
      T[SPIN] = sb * 0.7;
      T[AXL] = T[AXR] = -2.7;
      T[AZL] = T[AZR] = 0.3 * sb;
      T[LGL] = 0.07 * sb;
      T[LGR] = -0.07 * sb;
      T[BOB] = hop * 0.02;
      T[ROLL] = 0.03 * Math.sin(b * 0.5);
      T[HRX] = 0.06 * sb;
    } else if (move === 2) {
      // SWAY — side lean, head nodding, one arm up waving, one on the hip
      T[ROLL] = Math.sin(b * 0.5) * 0.16;
      T[HRX] = 0.06 + 0.18 * sb;
      T[AXR] = -2.7;
      T[AZR] = 0.4 * sb;
      T[AXL] = -0.6;
      T[AZL] = -0.5;
      T[LGL] = 0.05 * Math.sin(b * 0.5);
      T[LGR] = -0.05 * Math.sin(b * 0.5);
      T[BOB] = hop * 0.015;
    } else if (move === 3) {
      // SPIN — a full eased turn opening the segment, arms straight up (the
      // skirt flares from the yaw rate); light bounce for the rest of the bar
      const u = (b - seg * SEG) / TAU; // beats into the segment
      T[SPIN] = smooth(u / 1.6) * TAU;
      T[AXL] = T[AXR] = -2.85;
      T[AZL] = 0.06;
      T[AZR] = -0.06;
      T[BOB] = hop * 0.05;
      T[LGL] = T[LGR] = (1 - hop) * 0.12;
      T[ROLL] = 0;
      T[HRX] = -0.06;
    } else if (move === 4) {
      // ARM-WAVE — alternating raised-arm waves, swapping each bar
      const up = Math.floor(b / (TAU * 2)) % 2 === 0;
      const raised = -2.5 + 0.15 * Math.sin(b * 2);
      const low = -0.35 + 0.25 * sb;
      T[AXL] = up ? raised : low;
      T[AXR] = up ? low : raised;
      T[AZL] = up ? 0.35 * sb : -0.08;
      T[AZR] = up ? 0.08 : 0.35 * sb;
      T[LGL] = T[LGR] = (1 - hop) * 0.16;
      T[BOB] = hop * hop * 0.05;
      T[ROLL] = 0.05 * Math.sin(b * 0.5);
      T[HRX] = 0.08 * sb;
    } else {
      // SHUFFLE — side-step weight shifts, feet stepping, arms swinging low
      const w2 = Math.sin(b * 0.5);
      T[ROLL] = 0.09 * w2;
      T[LGL] = 0.2 * Math.max(0, w2);
      T[LGR] = 0.2 * Math.max(0, -w2);
      T[AXL] = -0.5 + 0.15 * sb;
      T[AXR] = -0.5 - 0.15 * sb;
      T[AZL] = 0.18 * Math.cos(b * 0.5);
      T[AZR] = 0.18 * Math.cos(b * 0.5);
      T[BOB] = hop * 0.03;
      T[HRX] = 0.07 * sb;
    }
  };

  const jumpTargets = (T: Float64Array, u: number, j: number) => {
    const h = 0.3 * j; // apex height
    const cr = 0.06 * Math.min(1, j); // crouch / landing compression depth
    T[ROLL] = 0;
    T[SPIN] = 0;
    T[HBOB] = 0;
    if (u < JUMP_ANT) {
      // anticipation crouch: knees forward, arms swing back, body dips
      const k = smooth(u / JUMP_ANT);
      T[LGL] = T[LGR] = 0.5 * k;
      T[AXL] = T[AXR] = 0.4 * k;
      T[AZL] = 0.06 * k;
      T[AZR] = -0.06 * k;
      T[BOB] = -cr * k;
      T[HRX] = 0.12 * k;
    } else if (u < JUMP_ANT + JUMP_FLY) {
      // parabolic flight: legs tuck, arms rise, head tips up at the apex
      const v = (u - JUMP_ANT) / JUMP_FLY;
      const sv = Math.sin(Math.PI * v);
      T[BOB] = -cr + (h + cr) * sv;
      T[LGL] = T[LGR] = 0.5 - 1.6 * sv;
      T[AXL] = T[AXR] = 0.4 - 2.6 * sv;
      T[AZL] = 0.06 + 0.2 * sv;
      T[AZR] = -0.06 - 0.2 * sv;
      T[HRX] = 0.12 - 0.3 * sv;
      T[HBOB] = 0.01 * sv;
    } else {
      // landing compression easing back upright (then the crossfade recovers
      // whatever state the jump interrupted)
      const q = smooth((u - JUMP_ANT - JUMP_FLY) / JUMP_LAND);
      T[LGL] = T[LGR] = 0.5 * (1 - q);
      T[AXL] = T[AXR] = 0.4 * (1 - q);
      T[AZL] = 0.06 * (1 - q);
      T[AZR] = -0.06 * (1 - q);
      T[BOB] = -cr * (1 - q);
      T[HRX] = 0.12 * (1 - q);
    }
  };

  const pose: PeepPose = {
    get state() {
      return state;
    },
    seed: 0,
    get spinYaw() {
      return applied[SPIN];
    },
    get headNod() {
      return applied[HRX];
    },
    setState(s: PoseState, speed?: number) {
      if (speed != null) {
        if (s === 'walk') speedTarget = Math.max(0, Math.min(speed, 13));
        else if (s === 'dance') beatHz = Math.max(0.2, Math.min(speed, 5));
        else if (s === 'jump') jumpAmp = Math.max(0.2, Math.min(speed, 2));
      }
      if (state === 'jump') {
        // let the arc finish: a non-jump request only retargets where it lands
        if (s === 'jump') {
          jumpT = 0; // re-trigger
          retarget();
        } else {
          returnState = s;
        }
        return;
      }
      if (s === state) return;
      if (s === 'jump') {
        returnState = state;
        jumpT = 0;
      }
      state = s;
      retarget();
    },
    setDanceStyle(k: number) {
      style = Math.floor(k);
    },
    update(time: number, dtOpt?: number) {
      let dt = dtOpt;
      if (dt == null) {
        dt = lastTime == null ? 1 / 60 : time - lastTime;
        lastTime = time;
      }
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 0.1);
      now += dt;
      speedSm += (speedTarget - speedSm) * Math.min(1, dt * 6);
      beat += beatHz * TAU * dt; // always ticks — crowd beats stay shared
      if (state === 'walk') {
        phase += speedSm * dt;
        if (phase > 1e4) phase %= TAU;
      }
      if (state === 'jump') {
        jumpT += dt;
        if (jumpT >= JUMP_T) {
          state = returnState;
          retarget(); // smooth recovery into the previous state
        }
      }
      if (state === 'idle') idleTargets(target, now, pose.seed);
      else if (state === 'walk') walkTargets(target, phase, Math.min(1, speedSm / 4) ** 0.8);
      else if (state === 'dance') danceTargets(target, beat, pose.seed);
      else jumpTargets(target, jumpT, jumpAmp);

      // crossfade from the snapshot, then slew-limit for hard continuity
      w = Math.min(1, w + dt / XFADE);
      const e = w * w * (3 - 2 * w);
      for (let ch = 0; ch < NCH; ch += 1) {
        let d = target[ch] - snap[ch];
        if (ch === SPIN) d = wrapPi(d);
        const cur = snap[ch] + d * e;
        let step = cur - applied[ch];
        if (ch === SPIN) step = wrapPi(step);
        const lim = RATE[ch] * dt;
        applied[ch] += Math.max(-lim, Math.min(lim, step));
      }

      legL.rotation.x = applied[LGL];
      legR.rotation.x = applied[LGR];
      armL.rotation.x = applied[AXL];
      armR.rotation.x = applied[AXR];
      armL.rotation.z = applied[AZL];
      armR.rotation.z = applied[AZR];
      grp.rotation.z = applied[ROLL];
      grp.position.y = applied[BOB];
      head.position.y = HEAD_Y + applied[HBOB];
      head.rotation.x = applied[HRX];

      if (skirt) {
        // the skirt chases body-yaw changes with a damped spring (lags behind
        // turns and spins) and flares on fast yaw / upward hops
        grp.getWorldQuaternion(_q);
        _e.setFromQuaternion(_q, 'YXZ');
        const wy = _e.y;
        const dy = lastYaw == null ? 0 : wrapPi(wy - lastYaw);
        lastYaw = wy;
        const yawVel = dy / dt;
        skirtVel += (-90 * skirtAng - 14 * skirtVel) * dt - yawVel * 2.4 * dt;
        skirtAng = Math.max(-0.65, Math.min(0.65, skirtAng + skirtVel * dt));
        skirt.rotation.y = skirtAng;
        const bobVel = (applied[BOB] - lastBob) / dt;
        const flareT = Math.min(0.35, Math.abs(yawVel) * 0.06 + Math.max(0, bobVel) * 0.5);
        flare += (flareT - flare) * Math.min(1, dt * (flareT > flare ? 12 : 3.5));
        skirt.scale.set(1 + flare, 1 - flare * 0.25, 1 + flare);
      }
      lastBob = applied[BOB];
    },
  };

  // ---- backwards-compatible walk(time, phase) — drives the pose controller.
  // Cadence (and so amplitude) is implied from how fast the caller advances
  // `time`, matching the old sin(time·5 + phase) gait; a constant time eases
  // the limbs to rest instead of freezing mid-swing.
  let wLastT: number | null = null;
  let wLastP: number | null = null;
  const walk = (time: number, ph = 0) => {
    const P = time * 5 + ph;
    let dtw = wLastT == null ? 1 / 60 : time - wLastT;
    wLastT = time;
    if (!(dtw > 0)) dtw = 1 / 60;
    dtw = Math.min(dtw, 0.1);
    const implied = wLastP == null ? 5 : Math.min(Math.abs(P - wLastP) / dtw, 13);
    wLastP = P;
    if (state !== 'walk') pose.setState('walk');
    speedTarget = implied;
    speedSm = implied; // legacy callers expect immediate cadence, not a ramp
    phase = P;
    pose.update(time, dtw);
  };

  // ---- sick face: swap the painted-face texture to the green variant -------
  // (cached per skin+expression+sick — first call per combo paints one canvas)
  const setSick = (on: boolean) => {
    const m = skull.material as THREE.MeshStandardMaterial;
    m.map = faceTexture(t, SKIN, expr, on);
    m.needsUpdate = true;
  };

  return { group: grp, walk, head, headSlot, armL, armR, legL, legR, pose, skirt, setSick };
}

// PREVIEW — the full ANIMATION SHOWCASE: every pose-layer state on one slab,
// grouped by POSITION (no ground text): two rows lined up along the fixed
// camera's screen-x.
//   BACK row:  idle (breathing) | stroll + brisk walk | seated on a bench |
//              looping jumps | sick (green face + hunch)
//   FRONT row: four dancers, one per dance style, styles rotating every 8 s
//              via pose.setDanceStyle (style-3 spinner is FEMALE — the
//              spinYaw skirt-swing + flare is front and centre) | eat + drink
//              (held burger / cup on the armR hand pivot with the same eased
//              lift-to-mouth overlay GameManager layers over the pose).
// Male and female variants alternate through the roster. Deterministic.
export function buildGuestScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // the whole line-up lives in a group yawed 45° so its local x-axis
        // maps onto the fixed 45°-azimuth camera's SCREEN-X (see RideEntrance)
        const lineup = new t.Group();
        lineup.rotation.y = Math.PI / 4;
        g.add(lineup);
        const SLAB_TOP = 0.06;
        lineup.add(box(t, [7.7, SLAB_TOP * 2, 3.3], 0x9a978e, [0, 0, 0], { tex: 'concrete', repeat: [10, 5], rough: 0.95 }));

        type Show = {
          x: number;
          z: number;
          female?: boolean;
          expression?: Expression;
          demo: 'idle' | 'stroll' | 'brisk' | 'seated' | 'jump' | 'sick' | 'dance' | 'eat' | 'drink';
          style?: number; // starting dance style
        };
        const BACK = -0.85;
        const FRONT = 0.95;
        const roster: Show[] = [
          // back row: idle | locomotion pair | seated | jump | sick
          { x: -3.25, z: BACK, demo: 'idle', expression: 'neutral' },
          { x: -2.3, z: BACK, demo: 'stroll', female: true },
          { x: -1.4, z: BACK, demo: 'brisk' },
          { x: 0.1, z: BACK, demo: 'seated', expression: 'happy' },
          { x: 1.6, z: BACK, demo: 'jump', expression: 'surprised' },
          { x: 3.1, z: BACK, demo: 'sick', expression: 'sad' },
          // front row: the dance-style quartet, then the snack pair
          { x: -3.2, z: FRONT, demo: 'dance', style: 0 },
          { x: -2.2, z: FRONT, demo: 'dance', style: 1, female: true },
          { x: -1.2, z: FRONT, demo: 'dance', style: 2 },
          { x: -0.2, z: FRONT, demo: 'dance', style: 3, female: true }, // skirt spinner
          { x: 1.7, z: FRONT, demo: 'eat', female: true, expression: 'happy' },
          { x: 2.7, z: FRONT, demo: 'drink' },
        ];

        // minimal local replica of GameManager's eat/drink overlay: a held
        // item on the armR hand ball plus an eased lift-to-mouth arm cycle
        // (raw cycle chased at ≤ 3/s, final armR slew-limited to 8.5 rad/s)
        const overlays: { k: number; arm: number | null }[] = [];
        const holdItem = (p: ReturnType<typeof buildPeep>, kind: 'eat' | 'drink') => {
          const item = new t.Group();
          // in front of the closed fist (fist front z 0.05), nudged outboard —
          // GameManager's exact attach, so the item clears hand/forearm/torso
          // (the slimmer cup sits nearer the fist than the burger)
          item.position.set(0.03, -0.37, kind === 'drink' ? 0.115 : 0.15);
          if (kind === 'eat') {
            const bun = ball(t, 0.095, 0xd8a85e, [0, 0.052, 0], { rough: 0.8 });
            bun.scale.set(1, 0.62, 1);
            item.add(bun);
            item.add(cyl(t, 0.098, 0.098, 0.035, 0x7a4a22, [0, 0, 0], { rough: 0.9, seg: 12 }));
            item.add(cyl(t, 0.088, 0.092, 0.032, 0xe2b26a, [0, -0.028, 0], { rough: 0.85, seg: 12 }));
          } else {
            item.add(cyl(t, 0.06, 0.048, 0.165, 0xc23028, [0, 0, 0], { rough: 0.6, seg: 12 }));
            item.add(cyl(t, 0.01, 0.01, 0.095, 0xf0f0e8, [0.022, 0.115, 0], { rough: 0.7, seg: 6 }));
          }
          p.armR.add(item);
        };
        const eatDrink = (p: ReturnType<typeof buildPeep>, ov: { k: number; arm: number | null }, time: number, dt: number, kind: 'eat' | 'drink', phase: number) => {
          let kRaw = 0;
          const lift = kind === 'drink' ? -2.0 : -1.85;
          if (kind === 'eat') {
            const c = (time + phase) % 1.6; // a bite every ~1.6 s
            if (c < 0.7) kRaw = Math.sin((c / 0.7) * Math.PI);
            p.head.rotation.x = p.pose.headNod + ov.k * 0.2; // nod into the bite
          } else {
            const c = (time + phase * 1.7) % 3.4; // longer, rarer swigs
            if (c < 1.2) kRaw = Math.min(1, Math.min(c, 1.2 - c) / 0.34);
            p.head.rotation.x = p.pose.headNod - ov.k * 0.12; // head tips back
          }
          ov.k += Math.max(-3 * dt, Math.min(3 * dt, kRaw - ov.k));
          const a = p.armR.rotation.x; // the pose's value this frame
          // carry bend (≤ -0.45) + inward shoulder tilt at the lift peak —
          // GameManager's exact overlay, keeping the item body-clear and
          // crossing it toward the mouth mid-bite
          const desired = Math.min(a + (lift - a) * ov.k, -0.45);
          const prev = ov.arm ?? desired;
          ov.arm = prev + Math.max(-8.5 * dt, Math.min(8.5 * dt, desired - prev));
          p.armR.rotation.x = ov.arm;
          p.armR.rotation.z += -0.4 * ov.k;
        };

        const peeps = roster.map((r, i) => {
          const p = buildPeep(t, {
            skin: SKIN_TONES[i % SKIN_TONES.length],
            hair: HAIRS[i % HAIRS.length],
            shirt: SHIRTS[i % SHIRTS.length],
            trousers: TROUSERS[i % TROUSERS.length],
            expression: r.expression ?? 'happy',
            female: r.female,
            seated: r.demo === 'seated',
          });
          p.pose.seed = i * 1.3;
          p.group.position.set(r.x, SLAB_TOP, r.z);
          lineup.add(p.group);
          overlays.push({ k: 0, arm: null });
          if (r.demo === 'stroll') p.pose.setState('walk', 4);
          else if (r.demo === 'brisk') p.pose.setState('walk', 9);
          else if (r.demo === 'dance') {
            p.pose.setDanceStyle(r.style ?? 0);
            p.pose.setState('dance', 2.2);
          } else if (r.demo === 'sick') {
            p.setSick(true); // green grimace face
            p.group.rotation.x = 0.22; // hunched forward (pose never owns pitch)
          } else if (r.demo === 'seated') {
            // parked on a bench, limbs left in the seated build pose (the pose
            // layer stays unticked — GameManager owns seated overlays in-game)
            const bench = new t.Group();
            bench.position.set(r.x, SLAB_TOP, r.z);
            bench.add(box(t, [0.62, 0.06, 0.4], 0x8a5a30, [0, 0.41, 0], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
            bench.add(box(t, [0.62, 0.3, 0.06], 0x8a5a30, [0, 0.62, -0.2], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
            [-1, 1].forEach((s) => bench.add(box(t, [0.06, 0.41, 0.34], 0x6b4620, [s * 0.26, 0.205, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 })));
            lineup.add(bench);
            p.group.position.y = SLAB_TOP - 0.01; // hip box lands on the seat
          }
          if (r.demo === 'eat' || r.demo === 'drink') holdItem(p, r.demo);
          return p;
        });

        let nextJump = 0.9;
        let lastTime = 0;
        return (time) => {
          const dt = Math.min(Math.max(time - lastTime, 1e-4), 0.1);
          lastTime = time;
          if (time >= nextJump) {
            peeps[4].pose.setState('jump'); // looping hops on a timer
            nextJump = time + 2.4;
          }
          const styleShift = Math.floor(time / 8); // all four styles cycle
          roster.forEach((r, i) => {
            const p = peeps[i];
            if (r.demo === 'seated') return; // static seated build pose
            if (r.demo === 'dance') p.pose.setDanceStyle(((r.style ?? 0) + styleShift) % 4);
            p.pose.update(time, dt);
            p.group.position.y += SLAB_TOP; // pose owns bob; re-add slab height
            // dance spins are a caller-applied yaw offset (pose never owns yaw)
            p.group.rotation.y = r.demo === 'dance' ? p.pose.spinYaw : 0;
            // phases chosen so both snackers are mid-lift around t ≈ 3.5 s
            if (r.demo === 'eat' || r.demo === 'drink') eatDrink(p, overlays[i], time, dt, r.demo, r.demo === 'eat' ? 0.05 : 0.294);
            if (r.demo === 'sick') p.head.rotation.x = p.pose.headNod + 0.12; // queasy droop (mild, keeps the green face visible)
          });
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <Guest> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const Guest = composable('Guest', (t) => buildGuestScene(t));

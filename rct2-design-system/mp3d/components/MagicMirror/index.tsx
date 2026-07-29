import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { box, mat, mergedBoxes, mergedParts, mtx, alongDir, nightKOf } from '../Stage';
import type { MergedBoxSpec, PartSpec, StageApi } from '../Stage';
import { hash01 } from '../ColorKit';
import { buildPeep, cadenceForSpeed, SHIRTS, SKIN_TONES, HAIRS, TROUSERS } from '../Guest';
import { composable } from '../Park';
import type { ComposableBuilt, ComposableProps, ParkContextValue } from '../Park';
import { UIWindow, UI_TEXT } from '../UIWindow';
import { THORNWICK, buildIvyStrand } from '../WyrmsHollow';

// ---------------------------------------------------------------------------
// MagicMirror — "The Whispering Glass", attraction 3 of the THORNWICK GLADE.
//
// IT IS NOT A RIDE. There is no queue, no station, no vehicle and no FSM: it is
// a `composable(...)` SCENERY-class component (the `components/Fence` /
// `components/Torch` shape), so none of the ride placement rules apply to it.
// It is an INTERACTIVE prop that guests play with.
//
// An ornate standing mirror in the glade: a mossy stone plinth, a carved frame
// of tarnished silver with leaf capitals and a scrolled crest, ivy creeping over
// it — and GLASS THAT WAKES UP. As a guest walks up, the tarnish clears and the
// glass shows an enchanted "reflection": a whimsical transformed silhouette of
// them (antlers, moth wings, a thorn crown, fox ears) drawn on a procedural
// emissive CanvasTexture. It reacts while they linger — the vision brightens and
// breathes, the frame runes light, the glass throws real light onto them — and
// fades back to dull silver when they wander off.
//
// HOW THE INTERACTION IS WIRED — three parts, and it REUSES the sim, it does not
// fork it:
//
//   1. GUESTS COME PAST IT because the composer stands it beside a street, and
//      they STOP for it because the `linger` prop registers a GameManager WATCH
//      ZONE (`registerWatchZone`, GameManager/registry.ts): a guest who wanders
//      inside enters PeepState 'watching', TURNS TO FACE the glass for a hashed
//      4-9 s, walks on, and is barred from re-latching that zone for 30 s.
//      `linger` is ON by default as of round 8. It used to be off and measured:
//      the only hook available then was `registerDanceZone`, which had no
//      per-guest cooldown, so a guest whose action expired inside the zone
//      re-latched at ~0.35/s and a zone across a street became a permanent stop
//      — one guest pinned 44.5 s of a 70 s run, three of six never resuming, and
//      a `validatePark` `sim` failure. The cooldown (both zone kinds now carry
//      one) plus the stationary 'watching' state fix both halves.
//   2. THE GLASS WAKES from this component's own side, by reading guest
//      positions out of `manager().guests()` (a copied, read-only accessor) once
//      a frame and transforming them into the mirror's LOCAL frame. Nothing is
//      written back into the sim, so the wake works whether or not the zone
//      registration exists — and it is the same code path the preview's demo
//      visitor drives, so a preview exercises the real logic.
//   3. CLICKING IT opens a themed `<UIWindow>` through the SHARED Stage pick
//      path. `Stage/index.tsx`'s `carrierOf` used to accept only
//      `userData.rideRef` / `guestRef`, which is why this component once carried
//      a private raycast; it now also accepts a generic `userData.pickRef`, so
//      the mirror tags its root group with one (alongside the `mirrorRef`
//      accessor the fleet convention wants) and its local raycast is GONE. It
//      therefore inherits the parent-chain visibility test, the real-geometry-
//      before-click-proxy ordering, the drag threshold and per-inset cameras for
//      free. The window itself is portalled into the Stage's positioned wrapper.
//
// Budget: 1 PointLight (the glass's own glow, wake-driven), no particles, every
// static repeat batched through `mergedBoxes`/`mergedParts`, close-up detail
// tagged `userData.lodDetail`. Deterministic throughout — hashed sines only, one
// absolute-time updater, no Math.random / Date.now, and both CanvasTextures are
// drawn once and cached module-level.
// ---------------------------------------------------------------------------

// ---- palette (Thornwick Glade — imported, never re-invented) --------------
const STONE = THORNWICK.stone;
const STONE_D = THORNWICK.stoneDark;
const MOSS = THORNWICK.moss;
const MOSS_D = THORNWICK.mossDeep;
const ROOT = THORNWICK.root;
/** TARNISHED SILVER. Metalness stays at 0.3: with no env map anything ≥ 0.6
 *  renders near-black in this fleet, and a black mirror frame is a hole. */
const SILVER = 0x9aa09a;
const SILVER_D = 0x767d76;
/** the green-black tarnish in the recesses and under the ivy */
const TARNISH = 0x5f6a5e;
/** the enchantment's two colours: a violet well and a green rim */
const SPELL = 0x8f7ad6;
const SPELL_G = 0x8ee0c0;

/** glass panel size — 1 : 1.5, which is exactly the vision canvas aspect, so
 *  nothing is stretched */
const GLASS_W = 0.58;
const GLASS_H = 0.87;
/** frame section width round the glass */
const FRAME_W = 0.11;
/** plinth top: where the frame stands */
const PLINTH_H = 0.26;
/** the glass sits on the plinth top; y of its bottom edge */
const GLASS_Y0 = PLINTH_H + 0.06;
/** the springing of the arched crown = the top of the flat glass */
const ARCH_Y = GLASS_Y0 + GLASS_H;
/** the local point a visitor is measured against — a pace in front of the glass */
const FOCUS: [number, number, number] = [0, 0.4, 0.55];

const smooth = (k: number) => {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
};

// ---------------------------------------------------------------------------
// THE DORMANT GLASS — a procedural CanvasTexture (the Restroom sign-plaque /
// RideEntrance LED-screen pattern: drawn once at build time with paths and
// gradients only, no fillText, no external assets, hashed-sine speckle).
//
// Old silvering: a dull green-grey gradient, cloudy TARNISH BLOOMS, foxing
// specks, a diagonal sheen band and a heavy vignette — because a mirror in a
// wood should look like nobody has cleaned it for a century, and because the
// vision has to have something to clear AWAY.
// ---------------------------------------------------------------------------
const VIS_W = 384;
const VIS_H = 576;

let _dullTex: THREE.CanvasTexture | null = null;
function dullGlassTexture(t: typeof THREE): THREE.CanvasTexture {
  if (_dullTex) return _dullTex;
  const c = document.createElement('canvas');
  c.width = VIS_W;
  c.height = VIS_H;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, VIS_W * 0.4, VIS_H);
  g.addColorStop(0, '#a8b0a5');
  g.addColorStop(0.45, '#828d81');
  g.addColorStop(1, '#5c665d');
  x.fillStyle = g;
  x.fillRect(0, 0, VIS_W, VIS_H);
  // cloudy tarnish blooms
  for (let i = 0; i < 26; i += 1) {
    const cx = hash01(i * 3.1 + 1) * VIS_W;
    const cy = hash01(i * 5.7 + 2) * VIS_H;
    const r = 24 + hash01(i * 7.3 + 3) * 96;
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = hash01(i * 9.1 + 4) > 0.5;
    rg.addColorStop(0, dark ? 'rgba(38,46,40,0.34)' : 'rgba(196,204,192,0.22)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  // foxing specks where the silvering has failed
  for (let i = 0; i < 420; i += 1) {
    const s = 1 + hash01(i * 2.7 + 11) * 2.6;
    x.fillStyle = hash01(i * 4.3 + 13) > 0.42 ? 'rgba(30,36,31,0.4)' : 'rgba(214,220,210,0.3)';
    x.fillRect(hash01(i * 6.1 + 17) * VIS_W, hash01(i * 8.9 + 19) * VIS_H, s, s);
  }
  // the diagonal sheen a flat pane always carries
  const sh = x.createLinearGradient(-VIS_W * 0.2, 0, VIS_W * 1.1, VIS_H);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.42, 'rgba(255,255,255,0.16)');
  sh.addColorStop(0.52, 'rgba(255,255,255,0.03)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = sh;
  x.fillRect(0, 0, VIS_W, VIS_H);
  // vignette — the edges of an old glass are always darker than its middle
  const vg = x.createRadialGradient(VIS_W / 2, VIS_H / 2, VIS_H * 0.18, VIS_W / 2, VIS_H / 2, VIS_H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(18,22,19,0.6)');
  x.fillStyle = vg;
  x.fillRect(0, 0, VIS_W, VIS_H);
  const tex = new t.CanvasTexture(c);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _dullTex = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// THE VISION — "the screen the user asked for": one procedural CanvasTexture per
// ENCHANTMENT, drawn with paths only and cached module-level, used as BOTH `map`
// and `emissiveMap` so a vision reads as painted glass in daylight and as light
// in the dark.
//
// Every vision is the same picture — a BUST silhouette of the guest standing in
// front of the mirror, in a violet well ringed with runes — with one thing added
// that the guest does not actually have. The silhouette is deliberately a
// SILHOUETTE: a reflection you can recognise yourself in is a portrait, and a
// portrait of a peep whose face the mirror cannot see would be a lie.
// ---------------------------------------------------------------------------
export type Enchantment = 'antlers' | 'wings' | 'crown' | 'fox';
export const ENCHANTMENTS: Enchantment[] = ['antlers', 'wings', 'crown', 'fox'];
/** the words the UI window shows for each */
export const ENCHANTMENT_NAMES: Record<Enchantment, string> = {
  antlers: 'Crowned with antlers',
  wings: 'Winged like a moth',
  crown: 'Wearing a thorn crown',
  fox: 'Given a fox’s ears and tail',
};

const _visTex = new Map<Enchantment, THREE.CanvasTexture>();

function visionTexture(t: typeof THREE, variant: Enchantment): THREE.CanvasTexture {
  const hit = _visTex.get(variant);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = VIS_W;
  c.height = VIS_H;
  const x = c.getContext('2d')!;
  const W = VIS_W;
  const H = VIS_H;
  const HEAD_X = W / 2;
  const HEAD_Y = H * 0.4;
  const HEAD_R = H * 0.098;
  const salt = ENCHANTMENTS.indexOf(variant) * 17 + 3;
  const h = (n: number) => hash01(salt * 1.9 + n * 3.7);

  // ---- the well: a violet glow deepening to green-black at the rim ----
  const bg = x.createRadialGradient(HEAD_X, HEAD_Y + H * 0.04, 8, HEAD_X, H * 0.52, H * 0.66);
  bg.addColorStop(0, '#a893e8');
  bg.addColorStop(0.22, '#6f5aa8');
  bg.addColorStop(0.55, '#33395e');
  bg.addColorStop(0.82, '#1b2431');
  bg.addColorStop(1, '#101a18');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // ---- two RUNE RINGS of ticks round the head (paths, never glyphs) ----
  x.strokeStyle = 'rgba(196,240,214,0.55)';
  [H * 0.3, H * 0.365].forEach((rr, ri) => {
    const n = ri ? 30 : 22;
    x.lineWidth = ri ? 2 : 3;
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * Math.PI * 2 + ri * 0.12;
      const l = (ri ? 5 : 9) * (0.5 + h(k + ri * 40) * 0.9);
      x.beginPath();
      x.moveTo(HEAD_X + Math.cos(a) * rr, HEAD_Y + Math.sin(a) * rr);
      x.lineTo(HEAD_X + Math.cos(a) * (rr + l), HEAD_Y + Math.sin(a) * (rr + l));
      x.stroke();
    }
  });

  // ---- MOTH WINGS go BEHIND the bust ----------------------------------
  if (variant === 'wings') {
    for (const s of [-1, 1]) {
      x.save();
      x.translate(HEAD_X, HEAD_Y + H * 0.13);
      x.scale(s, 1);
      const wg = x.createLinearGradient(0, -H * 0.12, W * 0.42, H * 0.2);
      wg.addColorStop(0, 'rgba(226,214,246,0.82)');
      wg.addColorStop(0.6, 'rgba(160,142,208,0.55)');
      wg.addColorStop(1, 'rgba(96,86,142,0.3)');
      x.fillStyle = wg;
      // fore wing
      x.beginPath();
      x.moveTo(6, 0);
      x.bezierCurveTo(W * 0.16, -H * 0.16, W * 0.4, -H * 0.14, W * 0.44, -H * 0.02);
      x.bezierCurveTo(W * 0.42, H * 0.05, W * 0.24, H * 0.06, 8, H * 0.03);
      x.closePath();
      x.fill();
      // hind wing
      x.beginPath();
      x.moveTo(6, H * 0.02);
      x.bezierCurveTo(W * 0.2, H * 0.06, W * 0.34, H * 0.14, W * 0.26, H * 0.22);
      x.bezierCurveTo(W * 0.18, H * 0.26, W * 0.06, H * 0.16, 6, H * 0.06);
      x.closePath();
      x.fill();
      // veins
      x.strokeStyle = 'rgba(70,62,104,0.6)';
      x.lineWidth = 2;
      for (let k = 0; k < 5; k += 1) {
        x.beginPath();
        x.moveTo(10, H * 0.005);
        x.quadraticCurveTo(W * (0.16 + k * 0.05), -H * (0.09 - k * 0.035), W * (0.24 + k * 0.045), -H * (0.09 - k * 0.05));
        x.stroke();
      }
      // one eye-spot per wing
      x.fillStyle = 'rgba(38,32,58,0.7)';
      x.beginPath();
      x.arc(W * 0.29, -H * 0.045, 12, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(226,240,214,0.8)';
      x.beginPath();
      x.arc(W * 0.29, -H * 0.045, 5, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  }

  // ---- the BUST: shoulders, neck, head ---------------------------------
  const ink = '#151b22';
  x.fillStyle = ink;
  x.beginPath();
  x.moveTo(HEAD_X - W * 0.3, H);
  x.lineTo(HEAD_X - W * 0.26, H * 0.68);
  x.quadraticCurveTo(HEAD_X - W * 0.19, H * 0.575, HEAD_X - W * 0.075, H * 0.55);
  x.lineTo(HEAD_X + W * 0.075, H * 0.55);
  x.quadraticCurveTo(HEAD_X + W * 0.19, H * 0.575, HEAD_X + W * 0.26, H * 0.68);
  x.lineTo(HEAD_X + W * 0.3, H);
  x.closePath();
  x.fill();
  x.beginPath(); // neck
  x.fillRect(HEAD_X - W * 0.055, HEAD_Y + HEAD_R * 0.5, W * 0.11, H * 0.1);
  x.beginPath(); // head
  x.arc(HEAD_X, HEAD_Y, HEAD_R, 0, Math.PI * 2);
  x.fill();

  // ---- the ENCHANTMENT, on top of the head -----------------------------
  x.strokeStyle = ink;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  if (variant === 'antlers') {
    for (const s of [-1, 1]) {
      const bx = HEAD_X + s * HEAD_R * 0.55;
      const by = HEAD_Y - HEAD_R * 0.72;
      x.lineWidth = 9;
      x.beginPath();
      x.moveTo(bx, by);
      x.bezierCurveTo(bx + s * 26, by - 44, bx + s * 20, by - 96, bx + s * 54, by - 132);
      x.stroke();
      // three tines up the beam, each shorter than the last
      [
        [0.3, 44, -30],
        [0.56, 52, -22],
        [0.8, 40, -14],
      ].forEach(([f, len, rise], k) => {
        const px = bx + s * (10 + (f as number) * 46);
        const py = by - (f as number) * 118;
        x.lineWidth = 7 - k;
        x.beginPath();
        x.moveTo(px, py);
        x.quadraticCurveTo(px + s * (len as number) * 0.6, py + (rise as number) * 0.4, px + s * (len as number), py + (rise as number));
        x.stroke();
      });
    }
  } else if (variant === 'crown') {
    // a ring of thorns round the brow, taller at the front
    const ry = HEAD_Y - HEAD_R * 0.42;
    x.lineWidth = 8;
    x.beginPath();
    x.ellipse(HEAD_X, ry, HEAD_R * 1.04, HEAD_R * 0.34, 0, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = ink;
    for (let k = 0; k < 9; k += 1) {
      const a = -Math.PI + (k / 8) * Math.PI * 2;
      const px = HEAD_X + Math.cos(a) * HEAD_R * 1.04;
      const py = ry + Math.sin(a) * HEAD_R * 0.34;
      const len = 16 + Math.abs(Math.cos(a)) * 6 + (1 - Math.abs(Math.sin(a))) * 22;
      const tilt = Math.cos(a) * 12;
      x.beginPath();
      x.moveTo(px - 6, py);
      x.lineTo(px + tilt * 0.3, py - len);
      x.lineTo(px + 6, py);
      x.closePath();
      x.fill();
    }
    // two little leaves tucked into it
    x.fillStyle = 'rgba(120,180,140,0.85)';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.ellipse(HEAD_X + s * HEAD_R * 0.78, ry - 6, 13, 6, s * 0.7, 0, Math.PI * 2);
      x.fill();
    }
  } else if (variant === 'fox') {
    x.fillStyle = ink;
    for (const s of [-1, 1]) {
      const bx = HEAD_X + s * HEAD_R * 0.6;
      const by = HEAD_Y - HEAD_R * 0.66;
      x.beginPath();
      x.moveTo(bx - s * 14, by + 8);
      x.lineTo(bx + s * 6, by - 52);
      x.lineTo(bx + s * 24, by + 2);
      x.closePath();
      x.fill();
      // the inner ear catches the glow
      x.fillStyle = 'rgba(190,150,120,0.7)';
      x.beginPath();
      x.moveTo(bx - s * 4, by + 4);
      x.lineTo(bx + s * 6, by - 34);
      x.lineTo(bx + s * 15, by + 1);
      x.closePath();
      x.fill();
      x.fillStyle = ink;
    }
    // the TAIL, curling up past the right shoulder with a pale tip
    x.lineWidth = 30;
    x.strokeStyle = ink;
    x.beginPath();
    x.moveTo(HEAD_X + W * 0.2, H * 0.86);
    x.bezierCurveTo(HEAD_X + W * 0.38, H * 0.8, HEAD_X + W * 0.42, H * 0.64, HEAD_X + W * 0.3, H * 0.56);
    x.stroke();
    x.lineWidth = 20;
    x.strokeStyle = 'rgba(226,236,214,0.85)';
    x.beginPath();
    x.moveTo(HEAD_X + W * 0.335, H * 0.6);
    x.quadraticCurveTo(HEAD_X + W * 0.33, H * 0.565, HEAD_X + W * 0.3, H * 0.552);
    x.stroke();
  }

  // ---- a green RIM LIGHT down the silhouette's left edge ----------------
  x.strokeStyle = 'rgba(142,224,192,0.75)';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(HEAD_X, HEAD_Y, HEAD_R + 1.5, Math.PI * 0.62, Math.PI * 1.42);
  x.stroke();
  x.beginPath();
  x.moveTo(HEAD_X - W * 0.077, H * 0.552);
  x.quadraticCurveTo(HEAD_X - W * 0.2, H * 0.578, HEAD_X - W * 0.268, H * 0.685);
  x.lineTo(HEAD_X - W * 0.308, H);
  x.stroke();

  // ---- sparkles: hashed motes over the whole pane ----------------------
  for (let i = 0; i < 130; i += 1) {
    const px = h(i + 200) * W;
    const py = h(i * 2.3 + 300) * H;
    const r = 0.7 + h(i * 3.7 + 400) * 2.3;
    x.fillStyle = h(i * 5.1 + 500) > 0.4 ? 'rgba(226,240,220,0.8)' : 'rgba(190,170,240,0.75)';
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
  // ---- the pane's own sheen + vignette, so it still reads as GLASS ------
  const sh = x.createLinearGradient(-W * 0.2, 0, W * 1.1, H);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.4, 'rgba(255,255,255,0.11)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = sh;
  x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,14,16,0.62)');
  x.fillStyle = vg;
  x.fillRect(0, 0, W, H);

  const tex = new t.CanvasTexture(c);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _visTex.set(variant, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// state published to the UI window + the harness
// ---------------------------------------------------------------------------
export interface MagicMirrorState {
  /** 0 = dull silver, 1 = fully awake */
  awake: number;
  /** the guest the glass is showing (sim guest id, or −1 for the demo visitor) */
  visitor: number | null;
  /** how long the current visitor has stood still in front of it, in seconds */
  lingering: number;
  /** which enchantment the glass is showing */
  enchantment: Enchantment | null;
  /** how many times the glass has woken since it was built */
  reflections: number;
  /** true when a linger (watch) ZONE was registered with the GameManager */
  zone: boolean;
}

export interface MagicMirrorHandle {
  api: StageApi;
  /** the mirror's root group — the raycast target and the `mirrorRef` carrier */
  group: THREE.Object3D;
  state(): MagicMirrorState;
}

/** the manager surface the mirror reads / registers through. Every member is
 *  OPTIONAL-CALLED: the mirror works with none of them. */
export interface MirrorMgr {
  guests?: () => { id: number; position: [number, number, number]; hidden?: boolean; gone?: boolean }[];
  /** the LINGER ZONE the mirror wants: guests inside it enter PeepState
   *  'watching', turn to FACE the glass for a hashed few seconds, then walk on
   *  — and cannot re-latch the same zone until its per-guest cooldown expires
   *  (GameManager/registry.ts). This is what makes `linger` safe on a street. */
  registerWatchZone?: (cfg: {
    center: [number, number];
    halfW: number;
    halfD: number;
    rotation?: number;
    faceAt?: [number, number];
    linger?: [number, number];
    cooldown?: number;
  }) => unknown;
  /** the older "guests inside this area stop and DANCE" registration — the
   *  fallback for a manager that predates `registerWatchZone` */
  registerDanceZone?: (cfg: { center: [number, number]; halfW: number; halfD: number; rotation?: number; cooldown?: number }) => unknown;
}

// ---------------------------------------------------------------------------
// the frame
// ---------------------------------------------------------------------------

export interface MagicMirrorOpts {
  /** how far in front the glass notices a visitor (default 1.6) */
  radius?: number;
  /** hashed-variation salt */
  seed?: number;
  /** force the glass awake — a reproducible screenshot still (default false) */
  awake?: boolean;
  /** pin WHICH vision the glass shows instead of hashing it off the visitor's
   *  guest id. Only for stills and for a park that wants one fixed reflection:
   *  the point of the hash is that two guests see different things. */
  enchantment?: Enchantment;
  /** a DECORATIVE demo visitor who walks up, stops, and walks away on a
   *  deterministic 18-second loop, driving the REAL wake logic. Default: ON
   *  under a `<ScenePreview>`, OFF inside a real `<Park>` (the fleet's
   *  decoration-off-when-registered convention — real guests do it there). */
  demo?: boolean;
}

export interface MagicMirrorBuilt extends ComposableBuilt {
  state: () => MagicMirrorState;
  /** wired by the `compose` hook in real parks — hands the mirror the sim it
   *  should read guests from, and the zone registration result */
  attach: (mgr: MirrorMgr | null, zone: boolean) => void;
}

/** one carved pillar of the frame, +y up, built as merged parts so the whole
 *  frame is two draw calls */
function pillarParts(t: typeof THREE, x: number, h0: number, h1: number, silver: PartSpec[], dark: PartSpec[]): void {
  const len = h1 - h0;
  silver.push({ geo: new t.CylinderGeometry(FRAME_W * 0.42, FRAME_W * 0.5, len, 8), matrix: mtx(t, [x, (h0 + h1) / 2, 0]), uv: [1, 3] });
  // three carved bands, and a leaf capital at the top
  [0.16, 0.5, 0.84].forEach((f, k) => {
    dark.push({
      geo: new t.TorusGeometry(FRAME_W * 0.5, FRAME_W * 0.13, 5, 12),
      matrix: mtx(t, [x, h0 + len * f, 0], [Math.PI / 2, 0, 0], [1, 1, 0.7]),
      uv: [2, 1],
    });
    void k;
  });
  silver.push({ geo: new t.CylinderGeometry(FRAME_W * 0.62, FRAME_W * 0.4, 0.07, 8), matrix: mtx(t, [x, h1 - 0.03, 0]) });
  // four leaves flaring out of the capital
  for (let k = 0; k < 4; k += 1) {
    const a = (k / 4) * Math.PI * 2 + 0.5;
    dark.push({
      geo: new t.SphereGeometry(0.038, 6, 4),
      matrix: mtx(t, [x + Math.cos(a) * 0.05, h1 - 0.045, Math.sin(a) * 0.045], [0, a, 0.5], [1.7, 0.5, 1]),
    });
  }
}

export function buildMagicMirror(t: typeof THREE, opts: MagicMirrorOpts = {}): MagicMirrorBuilt {
  const group = new t.Group();
  const RADIUS = opts.radius ?? 1.6;
  const seed = opts.seed ?? 1;
  const h = (n: number) => hash01(seed * 2.13 + n * 4.71);

  const silver: PartSpec[] = [];
  const dark: PartSpec[] = [];

  // ---- THE PLINTH: three courses of mossy glade masonry ----------------
  {
    const blocks: MergedBoxSpec[] = [];
    const shade: MergedBoxSpec[] = [];
    const moss: MergedBoxSpec[] = [];
    const courses: [number, number, number][] = [
      [0.98, 0.11, 0.5],
      [0.86, 0.09, 0.44],
      [0.78, 0.06, 0.4],
    ];
    let y = 0;
    courses.forEach(([w, ch, d], k) => {
      // each course is TWO blocks with a hashed joint, never one slab
      for (const s of [-1, 1] as const) {
        const spec: MergedBoxSpec = {
          dims: [w / 2 + 0.01, ch, d],
          pos: [s * (w / 4 + (h(k) - 0.5) * 0.02), y + ch / 2, (h(k + 3) - 0.5) * 0.01],
          rotY: s * (h(k + 5) - 0.5) * 0.05,
          repeat: [2, 1],
        };
        (h(k * 3 + (s > 0 ? 7 : 2)) > 0.55 ? shade : blocks).push(spec);
      }
      y += ch;
    });
    // moss along the plinth's shady edges + a fern tuft in one corner
    for (let k = 0; k < 9; k += 1) {
      const a = h(k + 20) * Math.PI * 2;
      moss.push({
        dims: [0.16 + h(k + 21) * 0.1, 0.04, 0.13 + h(k + 22) * 0.08],
        pos: [Math.cos(a) * 0.34, 0.11 + Math.floor(h(k + 23) * 2) * 0.09, Math.sin(a) * 0.19],
        rotY: h(k + 24) * 3,
      });
    }
    group.add(mergedBoxes(t, blocks, STONE, { tex: 'concrete', repeat: [2, 1], rough: 0.95, bump: 0.07 }));
    group.add(mergedBoxes(t, shade, STONE_D, { tex: 'concrete', repeat: [2, 1], rough: 0.96, bump: 0.07 }));
    const mm = mergedBoxes(t, moss, MOSS, { tex: 'fabric', rough: 0.96, bump: 0.05, flat: true });
    mm.castShadow = false;
    group.add(mm);
  }

  // ---- THE FRAME: two pillars, an arched crown, a crest, scrolled feet --
  const HALF = GLASS_W / 2 + FRAME_W / 2;
  pillarParts(t, -HALF, GLASS_Y0 - 0.05, ARCH_Y, silver, dark);
  pillarParts(t, HALF, GLASS_Y0 - 0.05, ARCH_Y, silver, dark);
  // the arched crown: a real torus half-ring of the frame's own section
  silver.push({
    geo: new t.TorusGeometry(HALF, FRAME_W * 0.46, 7, 26, Math.PI),
    matrix: mtx(t, [0, ARCH_Y, 0]),
    uv: [4, 1],
  });
  dark.push({
    geo: new t.TorusGeometry(HALF + FRAME_W * 0.3, FRAME_W * 0.14, 5, 26, Math.PI),
    matrix: mtx(t, [0, ARCH_Y, 0]),
    uv: [6, 1],
  });
  // the SILL under the glass, and a back panel so the mirror is an object
  silver.push({ geo: new t.BoxGeometry(HALF * 2 + FRAME_W, 0.07, 0.16), matrix: mtx(t, [0, GLASS_Y0 - 0.02, 0]), uv: [4, 1] });
  // THE CREST: a crescent moon over the keystone, on five radiating spikes
  {
    const crestY = ARCH_Y + HALF + 0.03;
    for (let k = 0; k < 5; k += 1) {
      const a = -0.9 + k * 0.45;
      dark.push({
        geo: new t.ConeGeometry(0.022, 0.13 + (k === 2 ? 0.07 : 0) - Math.abs(k - 2) * 0.018, 6),
        matrix: mtx(t, [Math.sin(a) * 0.1, crestY + 0.03, 0], [0, 0, -a]),
      });
    }
    // the crescent: a disc with a smaller disc bitten out of it, as a real
    // 2D Shape with a hole — a lit crescent is the glade's own emblem
    const cs = new t.Shape();
    cs.absarc(0, 0, 0.1, 0, Math.PI * 2, false);
    const hole = new t.Path();
    hole.absarc(0.062, 0.014, 0.086, 0, Math.PI * 2, true);
    cs.holes.push(hole);
    const crescent = new t.Mesh(
      new t.ExtrudeGeometry(cs, { depth: 0.03, bevelEnabled: false }),
      mat(t, SILVER, { tex: 'metal', metal: 0.3, rough: 0.42, bump: 0.03 }),
    );
    crescent.position.set(0, crestY + 0.14, -0.015);
    crescent.castShadow = true;
    group.add(crescent);
  }
  // scrolled FEET, so the frame stands on the plinth instead of sprouting from it
  for (const s of [-1, 1] as const) {
    dark.push({
      geo: new t.TorusGeometry(0.055, 0.019, 5, 12, Math.PI * 1.5),
      matrix: mtx(t, [s * HALF, GLASS_Y0 - 0.045, 0.06], [0, Math.PI / 2, s * 0.4]),
    });
    silver.push({ geo: new t.BoxGeometry(0.16, 0.045, 0.2), matrix: mtx(t, [s * HALF, GLASS_Y0 - 0.06, 0]), uv: [1, 1] });
  }
  // TWO STAY LEGS raking back off the crown — a standing mirror needs a prop,
  // and from behind the rig has to be a thing rather than a billboard. They
  // SPLAY outward at the foot (the first pass narrowed them and the pair read as
  // crossed sticks); a cross batten ties them together.
  for (const s of [-1, 1] as const) {
    const from = new t.Vector3(s * HALF * 0.7, ARCH_Y + HALF * 0.5, -0.03);
    const to = new t.Vector3(s * HALF * 1.22, 0.03, -0.56);
    const d = to.clone().sub(from);
    dark.push({ geo: new t.CylinderGeometry(0.019, 0.027, d.length(), 6), matrix: alongDir(t, from, d, d.length()), uv: [1, 4] });
  }
  {
    const a = new t.Vector3(-HALF * 1.02, GLASS_Y0 + 0.06, -0.36);
    const b = new t.Vector3(HALF * 1.02, GLASS_Y0 + 0.06, -0.36);
    const d = b.clone().sub(a);
    dark.push({ geo: new t.CylinderGeometry(0.015, 0.015, d.length(), 5), matrix: alongDir(t, a, d, d.length()), uv: [1, 3] });
  }
  // two battens across the back board, so the reverse is joinery and not a slab
  for (let k = 0; k < 2; k += 1)
    dark.push({
      geo: new t.BoxGeometry(GLASS_W + FRAME_W * 0.5, 0.05, 0.022),
      matrix: mtx(t, [0, GLASS_Y0 + 0.2 + k * 0.46, -0.062]),
      uv: [3, 1],
    });
  // ---- LEADED TRACERY over the lunette: five radial bars and an arc rib. A
  // bare ShapeGeometry semicircle is a flat plate whatever you do to its
  // material — and a flat plate a hand's breadth from the glass's own violet
  // PointLight blows out into a pale slab over the vision. The tracery breaks it
  // up and reads as leaded glass, which is what an arched top light IS.
  for (let k = 0; k < 5; k += 1) {
    const a = Math.PI * (0.1 + (k / 4) * 0.8);
    const p0 = new t.Vector3(0, ARCH_Y + 0.01, 0.012);
    const p1 = new t.Vector3(Math.cos(a) * (GLASS_W / 2 - 0.005), ARCH_Y + Math.sin(a) * (GLASS_W / 2 - 0.005), 0.012);
    const d = p1.clone().sub(p0);
    dark.push({ geo: new t.CylinderGeometry(0.011, 0.013, d.length(), 5), matrix: alongDir(t, p0, d, d.length()), uv: [1, 2] });
  }
  dark.push({
    geo: new t.TorusGeometry(GLASS_W * 0.29, 0.011, 5, 16, Math.PI),
    matrix: mtx(t, [0, ARCH_Y + 0.01, 0.012]),
  });
  dark.push({ geo: new t.SphereGeometry(0.028, 7, 5), matrix: mtx(t, [0, ARCH_Y + 0.01, 0.016], [0, 0, 0], [1, 0.7, 0.8]) });

  group.add(mergedParts(t, silver, mat(t, SILVER, { tex: 'metal', metal: 0.3, rough: 0.42, bump: 0.03 })));
  group.add(mergedParts(t, dark, mat(t, TARNISH, { tex: 'metal', metal: 0.26, rough: 0.62, bump: 0.05 })));

  // ---- the BACKING: a dark board behind the glass. Rectangular up to the
  // springing, then a SEMICIRCLE for the lunette — a rectangle carried on up
  // would poke out past the arch ring's corners.
  const backMat = mat(t, SILVER_D, { tex: 'metal', metal: 0.24, rough: 0.68, bump: 0.04 });
  group.add(box(t, [GLASS_W + FRAME_W * 0.6, GLASS_H + 0.1, 0.045], SILVER_D, [0, GLASS_Y0 + GLASS_H / 2 - 0.02, -0.035], {
    tex: 'metal',
    metal: 0.24,
    rough: 0.68,
    bump: 0.04,
  }));
  {
    const bs = new t.Shape();
    bs.absarc(0, 0, GLASS_W / 2 + FRAME_W * 0.3, 0, Math.PI, false);
    const lunBack = new t.Mesh(new t.ExtrudeGeometry(bs, { depth: 0.045, bevelEnabled: false }), backMat);
    lunBack.position.set(0, ARCH_Y, -0.058);
    lunBack.castShadow = true;
    group.add(lunBack);
  }

  // ---- THE GLASS: the dull pane, and the VISION over it ----------------
  // ROUGHNESS 0.5 / METALNESS 0.08, and NOT a mirror-like 0.24/0.28: the pane is
  // a VERTICAL plane, so it catches almost no direct sun, and with no env map a
  // low-roughness metallic vertical plane has nothing to reflect — the first pass
  // rendered the dormant glass as a black slab instead of dull silver. A little
  // base emissive keeps it off zero in shadow.
  const dullMat = new t.MeshStandardMaterial({
    map: dullGlassTexture(t),
    roughness: 0.5,
    metalness: 0.08,
    emissive: new t.Color(0x2c322c),
    emissiveIntensity: 0.42,
  });
  const pane = new t.Mesh(new t.PlaneGeometry(GLASS_W, GLASS_H), dullMat);
  pane.position.set(0, GLASS_Y0 + GLASS_H / 2, 0.008);
  pane.receiveShadow = true;
  group.add(pane);
  // the arched TOP LIGHT of the pane, so the glass fills the crown too. It gets
  // its OWN material rather than sharing the pane's: a ShapeGeometry's UVs do
  // not map the vision canvas sensibly, so instead of a picture the lunette
  // simply goes from tarnish to a violet GLOW with the wake — otherwise an
  // awake mirror read as a bright rectangle under a dull arch.
  // ROUGH and NON-metallic on purpose: the first pass gave the lunette the
  // pane's own 0.26/0.28, and a flat low-roughness plate facing the sky picked up
  // so much specular off the Stage's sun that the arch read as the brightest
  // thing on the whole mirror — a white slab over the vision.
  const lunetteMat = new t.MeshStandardMaterial({
    color: new t.Color(0x59645a),
    roughness: 0.7,
    metalness: 0.04,
    emissive: new t.Color(SPELL),
    emissiveIntensity: 0,
  });
  const lunetteShape = new t.Shape();
  lunetteShape.absarc(0, 0, GLASS_W / 2, 0, Math.PI, false);
  const lunette = new t.Mesh(new t.ShapeGeometry(lunetteShape, 20), lunetteMat);
  lunette.position.set(0, ARCH_Y, 0.008);
  group.add(lunette);
  // THE VISION plane, a hair in front of the pane; opacity IS the wake
  const visionMat = new t.MeshStandardMaterial({
    map: visionTexture(t, 'antlers'),
    emissive: new t.Color(0xffffff),
    emissiveMap: visionTexture(t, 'antlers'),
    emissiveIntensity: 0,
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const vision = new t.Mesh(new t.PlaneGeometry(GLASS_W, GLASS_H), visionMat);
  vision.position.set(0, GLASS_Y0 + GLASS_H / 2, 0.014);
  vision.castShadow = false;
  group.add(vision);

  // ---- FRAME RUNES: twelve little glyph blocks round the arch that light
  // with the vision. Emissive only — they cost nothing. ------------------
  const runeSpecs: MergedBoxSpec[] = [];
  for (let k = 0; k < 12; k += 1) {
    const a = Math.PI * (0.06 + (k / 11) * 0.88);
    const rr = HALF + FRAME_W * 0.06;
    runeSpecs.push({
      dims: [0.017, 0.017 + (k % 3) * 0.009, 0.014],
      pos: [Math.cos(a) * rr, ARCH_Y + Math.sin(a) * rr, 0.05],
      rotZ: a - Math.PI / 2,
    });
  }
  for (let k = 0; k < 6; k += 1) {
    // and six down each pillar's inner face
    for (const s of [-1, 1] as const)
      runeSpecs.push({
        dims: [0.015, 0.015 + (k % 2) * 0.009, 0.014],
        pos: [s * (HALF - FRAME_W * 0.34), GLASS_Y0 + 0.1 + k * ((GLASS_H - 0.2) / 5), 0.05],
      });
  }
  const runes = mergedBoxes(t, runeSpecs, 0x4a544d, { rough: 0.55 });
  const runeMat = runes.material as THREE.MeshStandardMaterial;
  runeMat.emissive = new t.Color(SPELL_G);
  runeMat.emissiveIntensity = 0;
  runes.castShadow = false;
  runes.userData.lodDetail = true;
  group.add(runes);

  // ---- IVY creeping over the frame, and a toadstool at the foot ---------
  for (let k = 0; k < 2; k += 1) {
    const s = k === 0 ? -1 : 1;
    const iv = buildIvyStrand(t, 0.3 + h(k + 40) * 0.3, seed * 11 + k);
    // tucked against the OUTSIDE of the frame, behind its own section, so the
    // leaves never cross the glass
    iv.position.set(s * (HALF + 0.055), ARCH_Y + HALF * (0.25 + h(k + 41) * 0.4), -0.02);
    iv.scale.setScalar(0.8);
    group.add(iv);
  }
  {
    const stems: PartSpec[] = [];
    const caps: PartSpec[] = [];
    for (let k = 0; k < 3; k += 1) {
      const a = 2.3 + h(k + 50) * 1.1;
      const rr = 0.42 + h(k + 51) * 0.1;
      const hh = 0.07 + h(k + 52) * 0.06;
      const p = new t.Vector3(Math.cos(a) * rr, 0.02, Math.sin(a) * rr * 0.55);
      stems.push({ geo: new t.CylinderGeometry(0.014, 0.019, hh, 6), matrix: alongDir(t, p, new t.Vector3(0.1, 1, 0.05), hh) });
      caps.push({
        geo: new t.SphereGeometry(0.036 + h(k + 53) * 0.014, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56),
        matrix: mtx(t, [p.x + 0.01, p.y + hh, p.z], [0, h(k + 54) * 3, 0], [1, 0.66, 1]),
      });
    }
    const st = mergedParts(t, stems, mat(t, 0xd6cdb2, { tex: 'fabric', rough: 0.94 }));
    st.userData.lodDetail = true;
    group.add(st);
    const cp = mergedParts(t, caps, mat(t, 0x63496f, { rough: 0.74, bump: 0.04 }));
    cp.userData.lodDetail = true;
    group.add(cp);
  }
  // a scatter of moss and root over the ground round the plinth
  {
    const litter: MergedBoxSpec[] = [];
    for (let k = 0; k < 14; k += 1) {
      const a = h(k + 60) * Math.PI * 2;
      const rr = 0.42 + h(k + 61) * 0.42;
      litter.push({
        dims: [0.14 + h(k + 62) * 0.14, 0.035, 0.11 + h(k + 63) * 0.12],
        pos: [Math.cos(a) * rr, 0.012, Math.sin(a) * rr * 0.7],
        rotY: h(k + 64) * 3,
      });
    }
    const lm = mergedBoxes(t, litter, h(9) > 0.5 ? MOSS_D : ROOT, { tex: 'fabric', rough: 0.97, flat: true });
    lm.castShadow = false;
    lm.userData.lodDetail = true;
    group.add(lm);
  }

  // ---- the ONE real light: the glass's own glow, driven by the wake -----
  const glow = new t.PointLight(SPELL, 0, 3.2, 2);
  // OUT IN FRONT of the pane and LOWER: the glass is meant to throw light onto
  // whoever is standing at it, not onto its own arch. Sat at the glass it lit the
  // lunette plate head-on and washed the frame's whole upper half pale.
  glow.position.set(0, GLASS_Y0 + GLASS_H * 0.4, 0.42);
  group.add(glow);

  // ---- the DEMO VISITOR: decorative, deterministic, and it drives the
  // REAL wake logic (it is fed into exactly the same `attend` test the sim
  // guests go through), so a standalone preview proves the interaction ----
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

  // ---- THE INTERACTION -------------------------------------------------
  let mgr: MirrorMgr | null = null;
  let zone = false;
  const state: MagicMirrorState = { awake: 0, visitor: null, lingering: 0, enchantment: null, reflections: 0, zone: false };
  /** per-visitor bookkeeping in the mirror's OWN frame: id → last local xz, how
   *  long they have stood still, and whether they are attending right now */
  const seen = new Map<number, { x: number; z: number; still: number; attending: boolean }>();
  const lp = new t.Vector3();
  const inv = new t.Matrix4();
  let lastT = -1;

  /** the LOCAL-space attend test both guest sources go through: a visitor is
   *  attending when they are IN FRONT of the glass (local z past the frame) and
   *  inside `radius` of the focus point a pace out from it */
  const attendOf = (x: number, z: number): number => {
    if (z < 0.14) return -1; // behind or level with the frame — no reflection
    const d = Math.hypot(x - FOCUS[0], z - FOCUS[2]);
    return d <= RADIUS ? d : -1;
  };

  const update = (time: number) => {
    const dt = lastT < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, time - lastT));
    lastT = time;
    group.updateWorldMatrix(true, false); // static prop: cheap, and the world
    // matrix is what turns sim guests' world positions into local ones. The
    // inverse is taken ONCE per frame, not once per guest (worldToLocal inverts
    // the matrix on every call, and a busy park has dozens of guests).
    inv.copy(group.matrixWorld).invert();

    // ---- 1. WHO IS AT THE GLASS ---------------------------------------
    let bestId: number | null = null;
    let bestD = Infinity;
    let bestStill = 0;
    const consider = (id: number, wx: number, wy: number, wz: number) => {
      lp.set(wx, wy, wz).applyMatrix4(inv);
      const d = attendOf(lp.x, lp.z);
      const rec = seen.get(id) ?? { x: lp.x, z: lp.z, still: 0, attending: false };
      // STILLNESS, in the mirror's own frame and measured PER SECOND, not per
      // frame: a walking 0.5-scale guest makes ~0.55 u/s, so 0.14 u/s is a stop.
      const speed = Math.hypot(lp.x - rec.x, lp.z - rec.z) / Math.max(dt, 1e-4);
      rec.still = speed < 0.14 ? rec.still + dt : 0;
      rec.x = lp.x;
      rec.z = lp.z;
      rec.attending = d >= 0;
      seen.set(id, rec);
      if (d >= 0 && d < bestD) {
        bestD = d;
        bestId = id;
        bestStill = rec.still;
      }
    };

    // the DEMO visitor first (it is the preview's only guest)
    if (demoPeep) {
      // an 18-second loop: approach 4 s, stand 8 s, leave 4 s, offstage 2 s
      const T = 18;
      const ph = ((time % T) + T) % T;
      let z = 3.0;
      let walking = true;
      if (ph < 4) z = 3.0 - (ph / 4) * 2.24; // 3.00 → 0.76
      else if (ph < 12) {
        z = 0.76;
        walking = false;
      } else if (ph < 16) z = 0.76 + ((ph - 12) / 4) * 2.24;
      else {
        z = 3.0;
        walking = false;
      }
      const dx = -0.1;
      demoPeep.group.visible = ph < 16;
      demoPeep.group.position.set(dx, 0, z);
      // face the glass on the way in and while standing; turn away to leave
      demoPeep.group.rotation.y = ph < 12 ? Math.PI : 0;
      if (walking) demoPeep.pose.setState('walk', cadenceForSpeed(0.56, 0.5));
      else demoPeep.pose.setState('idle');
      demoPeep.pose.update(time, dt);
      if (demoPeep.group.visible) {
        const wv = new t.Vector3(dx, 0, z);
        group.localToWorld(wv);
        consider(-1, wv.x, wv.y, wv.z);
      }
    }
    // then the REAL sim guests, when a manager was attached
    const rows = mgr?.guests?.();
    if (rows)
      for (const gst of rows) {
        if (gst.hidden || gst.gone) continue;
        consider(gst.id, gst.position[0], gst.position[1], gst.position[2]);
      }

    // ---- 2. THE WAKE ---------------------------------------------------
    // rises over ~0.7 s while somebody is there, falls over ~1.6 s when they
    // are not; the ENCHANTMENT is latched per visitor and only re-picked once
    // the glass has gone fully dark again, so it never flickers between two
    // guests walking past each other
    const target = bestId === null && !opts.awake ? 0 : 1;
    const rate = target > state.awake ? 1 / 0.7 : 1 / 1.6;
    state.awake = Math.max(0, Math.min(1, state.awake + Math.sign(target - state.awake) * rate * dt));
    /** show a (new) visitor: pick their enchantment and swap the canvas in */
    const latch = (id: number) => {
      state.visitor = id;
      state.enchantment =
        opts.enchantment ?? ENCHANTMENTS[Math.floor(hash01(id * 7.31 + seed * 3.7) * ENCHANTMENTS.length) % ENCHANTMENTS.length];
      state.reflections += 1;
      const tex = visionTexture(t, state.enchantment);
      visionMat.map = tex;
      visionMat.emissiveMap = tex;
      visionMat.needsUpdate = true;
    };
    // THE LATCH is what stops the vision flickering between two guests walking
    // past each other: the glass keeps showing whoever it started on for as long
    // as they are still there, and only re-picks when they have gone.
    const latchedStillThere = state.visitor !== null && (seen.get(state.visitor)?.attending ?? false);
    if (bestId !== null && !latchedStillThere) latch(bestId);
    if (bestId !== null) state.lingering = state.visitor === bestId ? bestStill : (seen.get(state.visitor!)?.still ?? bestStill);
    if (bestId === null && state.awake <= 0.001) {
      state.visitor = null;
      state.lingering = 0;
    }
    // `awake` forces a vision with nobody there — a reproducible screenshot still
    if (opts.awake && state.enchantment === null) latch(-1); // id −1 = "a curious stranger"

    // ---- 3. WHAT THE WAKE DRIVES --------------------------------------
    const w = smooth(state.awake);
    const nk = smooth(nightKOf(group));
    // the vision BREATHES, and breathes harder the longer they linger
    const linger = Math.min(1, state.lingering / 6);
    const breathe = 0.86 + 0.14 * Math.sin(time * 1.7) + 0.06 * Math.sin(time * 3.9 + 1.1) + 0.06 * linger * Math.sin(time * 5.3);
    visionMat.opacity = Math.min(1, w * (0.84 + 0.16 * breathe));
    visionMat.emissiveIntensity = w * (0.55 + 1.35 * nk + 0.35 * linger) * breathe;
    // the dull pane darkens as the vision takes it over, so the two never
    // read as two stacked pictures
    dullMat.emissiveIntensity = (0.42 + 0.12 * nk) * (1 - 0.7 * w);
    // `setScalar` is right for the PANE (it has a map, so the colour is a
    // multiplier and this just dims the tarnish under the vision) and WRONG for
    // the lunette (no map: setScalar would set it to a flat light GREY, which is
    // exactly how the arch ended up as a white slab over the vision). The
    // lunette keeps its built colour and only its emissive moves.
    dullMat.color.setScalar(1 - 0.55 * w);
    lunetteMat.emissiveIntensity = w * (0.3 + 0.9 * nk) * breathe;
    runeMat.emissiveIntensity = w * (0.35 + 1.1 * nk) * breathe;
    glow.intensity = w * (0.55 + 1.9 * nk) * (0.9 + 0.1 * Math.sin(time * 2.3));
    glow.color.setHex(linger > 0.5 ? SPELL_G : SPELL);
    state.zone = zone;
  };

  group.userData.mirrorRef = () => ({ ...state });
  return {
    group,
    update,
    state: () => ({ ...state }),
    attach: (m, z) => {
      mgr = m;
      zone = z;
    },
  };
}

// ---------------------------------------------------------------------------
// the composable + its UI window
// ---------------------------------------------------------------------------

export interface MagicMirrorProps extends MagicMirrorOpts {
  /** inside a real `<Park>`: attach the GameManager so the glass can SEE the
   *  guests walking past it and wake for them (default true; read-only — the
   *  mirror never writes to the sim). */
  register?: boolean;
  /** register a GameManager WATCH ZONE so guests STOP in front of the glass and
   *  turn to look at it instead of only walking past. **Default TRUE since the
   *  manager gained `registerWatchZone` (round 8).**
   *
   *  It used to default FALSE, and the measurement is worth keeping: the only
   *  hook available then was `registerDanceZone`, which had NO per-guest
   *  cooldown, so a guest whose action expired while still inside re-latched at
   *  ~0.35/s and a zone laid over a street edge became a permanent stop — in
   *  `mm-behaviour.mjs --linger` one guest was pinned 44.5 s of a 70 s run,
   *  three of six never resumed, and `validatePark` failed the plot's `sim`
   *  gate ("guest 1 stood still >25 sim-s while walking — stuck off the
   *  graph?"). The watch zone fixes both halves of that: a per-guest re-latch
   *  cooldown, and PeepState 'watching' (which is a stationary state the sim
   *  and validator both understand) instead of a 'dance' action taken while
   *  nominally still "walking". Set false where you want the glass to be pure
   *  scenery. */
  linger?: boolean;
  /** also register the plinth as a guest BLOCKER (default false). Off by
   *  default on purpose: a blocker beside a street is what `validatePark`'s
   *  `blockers` gate fails on, and a mirror is a thing to walk UP to. */
  blocking?: boolean;
  /** internal: hands the mounted rig to the window layer */
  bind?: (h: MagicMirrorHandle | null) => void;
}

const MagicMirrorBase = composable<MagicMirrorProps, MagicMirrorBuilt>(
  'MagicMirror',
  (t, props, park) => {
    const preview = (park as unknown as { _previewHost?: boolean })._previewHost === true;
    const built = buildMagicMirror(t, {
      radius: props.radius,
      seed: props.seed,
      awake: props.awake,
      enchantment: props.enchantment,
      // decorative demo visitor: on under a preview host, off in a real park
      demo: props.demo ?? preview,
    });
    // hand the rig (and the live Stage api) to the React window layer
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
      // the ground-contact footprint, so validatePark refuses a mirror planted
      // in open water or standing in a path slab (the <Scenery>/<Placed> rule)
      park.registerPlanted?.({ label: '<MagicMirror> plinth', x: position[0], z: position[2], r: 0.45 * scale });
      let mgr: MirrorMgr | null = null;
      let zone = false;
      if (props.register ?? true) mgr = park.manager() as MirrorMgr;
      if ((props.linger ?? true) && mgr) {
        // THE LINGER ZONE. Centred a pace in FRONT of the glass (the mirror's
        // local +z), 1.15 either way — big enough that a guest strolling the
        // street alongside has their polyline inside it, small enough that it
        // does not swallow the whole plaza. `faceAt` is the PLINTH, so a latched
        // guest turns and looks at the glass rather than standing side-on.
        const fx = position[0] + Math.sin(rotation) * FOCUS[2] * scale;
        const fz = position[2] + Math.cos(rotation) * FOCUS[2] * scale;
        // ---- THE ZONE IS SNAPPED ONTO THE WALKING LINE (2026-07-28) ---------
        // Reported as "guests don't seem incentivized to try the magic mirror".
        // An attention zone is a CATCHER, not a lure: nothing in the sim ever
        // routes a guest here (`GameManager/navigation.ts` has goal kinds for
        // rides, stalls, restrooms and benches and none for a zone), so the ONLY
        // way it fires is a wanderer whose position enters the rectangle — and
        // guests walk EXACTLY along the node-to-node line, with no lateral lane
        // offset (`GameManager/locomotion.ts`). Two consequences, both fatal to
        // a zone sized to the prop:
        //   1. a rectangle that does not CONTAIN a stretch of path polyline has
        //      a latch probability of exactly ZERO, not merely a low one. A
        //      mirror set back off the street is unvisitable however long it
        //      stands there.
        //   2. the latch coin is 0.35 ONCE PER SIM SECOND while inside
        //      (`GameManager/guestPass.ts`), and a guest walks ~1.2 u/s, so a
        //      2.3 u zone crossed square-on gives ~1.9 s ≈ two flips ≈ 58%. To
        //      be reliably noticed the zone has to span ~3.5 u ALONG the
        //      direction of travel: 3 flips ≈ 72%, 4 ≈ 82%.
        // So the zone is aligned to the nearest walking EDGE and stretched along
        // it, rather than being a square centred on the prop.
        const net = park.paths?.net;
        let zc: [number, number] = [fx, fz];
        let zr = rotation;
        let zw = 1.15 * scale;
        let zd = 1.15 * scale;
        let reach = Infinity;
        if (net && net.edges.length) {
          let best: { d: number; px: number; pz: number; yaw: number } | null = null;
          for (const [ai, bi] of net.edges) {
            const A = net.nodes[ai];
            const B = net.nodes[bi];
            if (!A || !B) continue;
            const ex = B[0] - A[0];
            const ez = B[1] - A[1];
            const l2 = ex * ex + ez * ez;
            if (l2 < 1e-6) continue;
            const tt = Math.max(0, Math.min(1, ((fx - A[0]) * ex + (fz - A[1]) * ez) / l2));
            const px = A[0] + ex * tt;
            const pz = A[1] + ez * tt;
            const d = Math.hypot(px - fx, pz - fz);
            if (!best || d < best.d) best = { d, px, pz, yaw: Math.atan2(ex, ez) };
          }
          // 3.0 u is the reach: further than that and the mirror is not beside a
          // street at all, and stretching a zone out to grab one would stop
          // guests in the middle of nowhere facing a mirror they cannot see.
          if (best && best.d <= 3.0) {
            reach = best.d;
            zr = best.yaw;                                     // align WITH the street
            zw = Math.max(1.8, 1.15 * scale);                  // ≥3.6 u of travel
            zd = Math.max(0.85 * scale, best.d * 0.5 + 0.55);  // straddle the line
            zc = [(fx + best.px) / 2, (fz + best.pz) / 2];     // …from prop to line
          } else if (best) {
            reach = best.d;
          }
        }
        // A WARNING, deliberately not a `park.reportLint`: an unmapped lint kind
        // reaches `harness/park-eval/score-park.mjs`, and a placement note has no
        // business moving a park's score before someone has decided which axis it
        // belongs to. This is the same COMPONENT-prefixed console channel the
        // fleet already uses for advice.
        if (reach > 3.0) {
          // eslint-disable-next-line no-console
          console.warn(
            `[MagicMirror] at [${position[0].toFixed(1)}, ${position[2].toFixed(1)}] is ${
              reach === Infinity ? 'nowhere near' : `${reach.toFixed(1)} u from`
            } a walking edge, so NO GUEST WILL EVER STOP AT IT — an attention zone only fires for a guest whose own position enters it, and guests walk exactly on the path lines. Mount it within ~2 u of a street or plaza edge.`,
          );
        }
        if (mgr.registerWatchZone) {
          mgr.registerWatchZone({
            center: zc,
            halfW: zw,
            halfD: zd,
            rotation: zr,
            faceAt: [position[0], position[2]],
            // a LOOK, not a residency — and the manager's per-guest cooldown
            // (30 s by default) is what keeps the street flowing past it
            linger: [4, 9],
          });
          zone = true;
        } else if (mgr.registerDanceZone) {
          // pre-watch-zone manager: the dance zone is the nearest thing. It
          // beat-dances instead of watching and dwells 10-30 s, so ask for the
          // shortest cooldown that still guarantees a guest walks clear.
          mgr.registerDanceZone({ center: [fx, fz], halfW: 1.15 * scale, halfD: 1.15 * scale, rotation, cooldown: 30 });
          zone = true;
        } else {
          console.warn(
            '[MagicMirror] linger: this GameManager exposes no linger-zone registration — the glass still wakes for guests walking past, but nothing makes them STOP (components/MagicMirror/Context.md)',
          );
        }
      }
      if (props.blocking) {
        const un = park.registerBlocker?.({
          rect: { cx: position[0], cz: position[2], hx: 0.5 * scale, hz: 0.26 * scale, yaw: rotation },
          label: '<MagicMirror> plinth',
          kind: 'scenery',
          height: (ARCH_Y + 0.4) * scale,
        });
        if (un) cleanups.push(un);
      }
      built.attach(mgr, zone);
      return cleanups.length ? () => cleanups.forEach((c) => c()) : undefined;
    },
  },
);

/** the window's own row helper — RCT2 chrome, glade wording */
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
 * <MagicMirror> — the glade's INTERACTIVE standing mirror, as a composable
 * SCENERY component (components/Park/Context.md): mounts at
 * `position`/`rotation`/`scale` inside a `<Park>` or a `<ScenePreview>`. It is
 * NOT a ride — no queue, no station, no FSM, no `register` ride wiring.
 *
 * Inside a real `<Park>` it registers a GameManager WATCH ZONE so wandering
 * guests stop and turn to face it (`linger`, ON by default), reads their
 * positions out of the GameManager to WAKE the glass, and opens a themed window
 * when clicked through the shared `userData.pickRef` Stage pick path. See the
 * module header and MagicMirror/Context.md for exactly how each of the three is
 * wired.
 */
export const MagicMirror: React.FC<MagicMirrorProps & ComposableProps> = (props) => {
  const [handle, setHandle] = useState<MagicMirrorHandle | null>(null);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  // CLICK → the window, through the SHARED Stage pick path (round 8). The
  // mirror used to carry its own raycast off the canvas because Stage's
  // `carrierOf` only accepted `rideRef`/`guestRef`; it now accepts a generic
  // `userData.pickRef`, so tagging the root group is the whole wiring and the
  // mirror inherits everything that path already gets right — the parent-chain
  // visibility test, real-geometry-before-click-proxy ordering, the drag
  // threshold, the ±6 px near-miss ring and per-INSET cameras (a click inside a
  // framed monitor picks what the monitor shows).
  //
  // Both delivery routes converge on the same idempotent `setOpen(true)`:
  // `<Park>`'s own onPick handler CALLS `userData.pickRef(obj)`, and the
  // subscription below covers a bare `<ScenePreview>` host that has no <Park>.
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
      <MagicMirrorBase {...props} bind={setHandle} />
      {open && st && target
        ? createPortal(
            <UIWindow title="The Whispering Glass" x={10} y={10} width={222} onClose={() => setOpen(false)}>
              <div style={{ ...UI_TEXT.header, marginTop: 1 }}>The glass</div>
              <Row
                label={st.awake > 0.55 ? 'Awake' : st.awake > 0.05 ? 'Stirring' : 'Dull silver'}
                value={`${Math.round(st.awake * 100)}%`}
                tint={st.awake > 0.55 ? '#5B3FA8' : undefined}
              />
              <Bar k={st.awake} color="#7A5FC8" />
              <Row label="Reflections shown" value={st.reflections} />
              <div style={{ ...UI_TEXT.header, marginTop: 4 }}>Reflected</div>
              {st.visitor === null ? (
                <div style={{ ...UI_TEXT.value, fontStyle: 'italic' }}>Nobody is standing in front of it.</div>
              ) : (
                <>
                  <Row label="Visitor" value={st.visitor < 0 ? 'A curious stranger' : `Guest ${st.visitor + 1}`} />
                  <Row label="Shown as" value={st.enchantment ? ENCHANTMENT_NAMES[st.enchantment] : '—'} tint="#1E5A4A" />
                  <Row label="Lingering" value={`${st.lingering.toFixed(1)} s`} />
                </>
              )}
              <div style={{ ...UI_TEXT.header, marginTop: 4 }}>Enchantment</div>
              <div style={{ ...UI_TEXT.value, lineHeight: 1.35 }}>
                {st.zone
                  ? 'A watch zone is registered: guests who wander past stop and turn to look into it, then walk on.'
                  : 'The glass wakes for anyone who walks past, and dims again behind them.'}
              </div>
            </UIWindow>,
            target,
          )
        : null}
    </>
  );
};
MagicMirror.displayName = 'MagicMirror';

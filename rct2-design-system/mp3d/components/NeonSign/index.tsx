import React from 'react';
import * as THREE from 'three';
import { box, cyl, mat, nightKOf } from '../Stage';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// NeonSign — glowing neon tube signage. TEXT mode renders a string with a
// compact 16-segment-style vector font (per-character polyline strokes);
// PATH mode renders any SVG path string (M/m L/l H/h V/v C/c Q/q Z) as a
// neon outline. Every stroke becomes a TubeGeometry pair: an emissive core
// tube plus a slightly larger transparent halo tube. Tubes mount on stand-off
// pins to an optional dark metal backboard (hugs the text with ~0.15×height
// padding, and over ~4 u² of face it falls back to the rail — round-2) or an
// open rear rail, so nothing floats. update(time) drives a subtle hashed
// flicker (occasional dips — deterministic, no Math.random) and night-gates
// the glow via nightKOf (day ≈ 12% residual, full neon at night) plus ONE
// tinted PointLight.
// ---------------------------------------------------------------------------

// deterministic pseudo-random from an integer key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (k: number) => k * k * (3 - 2 * k);

// ---- compact 16-segment-style vector font --------------------------------
// Glyphs live in a cell 0..w wide, 0..1.5 tall; strokes are polylines.
type Pt = [number, number];
interface Glyph {
  w: number;
  strokes: Pt[][];
}
const T = 1.5; // cap height
const M = 0.75; // mid bar
const G = (w: number, ...strokes: Pt[][]): Glyph => ({ w, strokes });
const FONT: Record<string, Glyph> = {
  A: G(1, [[0, 0], [0, T], [1, T], [1, 0]], [[0, M], [1, M]]),
  B: G(1, [[0, 0], [0, T], [0.9, T], [1, T - 0.2], [1, M + 0.15], [0.9, M], [0, M]], [[0.9, M], [1, M - 0.15], [1, 0.2], [0.9, 0], [0, 0]]),
  C: G(1, [[1, T], [0, T], [0, 0], [1, 0]]),
  D: G(1, [[0, 0], [0, T], [0.72, T], [1, T - 0.3], [1, 0.3], [0.72, 0], [0, 0]]),
  E: G(1, [[1, T], [0, T], [0, 0], [1, 0]], [[0, M], [0.8, M]]),
  F: G(1, [[1, T], [0, T], [0, 0]], [[0, M], [0.8, M]]),
  G: G(1, [[1, T], [0, T], [0, 0], [1, 0], [1, M], [0.55, M]]),
  H: G(1, [[0, 0], [0, T]], [[1, 0], [1, T]], [[0, M], [1, M]]),
  I: G(0.6, [[0.3, 0], [0.3, T]], [[0.05, T], [0.55, T]], [[0.05, 0], [0.55, 0]]),
  J: G(1, [[1, T], [1, 0.28], [0.78, 0], [0.2, 0], [0, 0.28]]),
  K: G(1, [[0, 0], [0, T]], [[1, T], [0, M], [1, 0]]),
  L: G(1, [[0, T], [0, 0], [1, 0]]),
  M: G(1.1, [[0, 0], [0, T], [0.55, M], [1.1, T], [1.1, 0]]),
  N: G(1, [[0, 0], [0, T], [1, 0], [1, T]]),
  O: G(1, [[0, 0], [0, T], [1, T], [1, 0], [0, 0]]),
  P: G(1, [[0, 0], [0, T], [1, T], [1, M], [0, M]]),
  Q: G(1, [[0, 0], [0, T], [1, T], [1, 0], [0, 0]], [[0.55, 0.45], [1.05, -0.08]]),
  R: G(1, [[0, 0], [0, T], [1, T], [1, M], [0, M]], [[0.42, M], [1, 0]]),
  S: G(1, [[1, T], [0, T], [0, M], [1, M], [1, 0], [0, 0]]),
  T: G(1, [[0, T], [1, T]], [[0.5, T], [0.5, 0]]),
  U: G(1, [[0, T], [0, 0], [1, 0], [1, T]]),
  V: G(1, [[0, T], [0.5, 0], [1, T]]),
  W: G(1.1, [[0, T], [0.25, 0], [0.55, M], [0.85, 0], [1.1, T]]),
  X: G(1, [[0, T], [1, 0]], [[1, T], [0, 0]]),
  Y: G(1, [[0, T], [0.5, M], [1, T]], [[0.5, M], [0.5, 0]]),
  Z: G(1, [[0, T], [1, T], [0, 0], [1, 0]]),
  '0': G(1, [[0, 0], [0, T], [1, T], [1, 0], [0, 0]], [[0.15, 0.2], [0.85, T - 0.2]]),
  '1': G(0.6, [[0.05, T - 0.3], [0.35, T], [0.35, 0]], [[0.05, 0], [0.6, 0]]),
  '2': G(1, [[0, T], [1, T], [1, M], [0, M], [0, 0], [1, 0]]),
  '3': G(1, [[0, T], [1, T], [1, 0], [0, 0]], [[0.25, M], [1, M]]),
  '4': G(1, [[0, T], [0, M], [1, M]], [[0.75, T], [0.75, 0]]),
  '5': G(1, [[1, T], [0, T], [0, M], [1, M], [1, 0], [0, 0]]),
  '6': G(1, [[1, T], [0, T], [0, 0], [1, 0], [1, M], [0, M]]),
  '7': G(1, [[0, T], [1, T], [0.4, 0]]),
  '8': G(1, [[0, 0], [0, T], [1, T], [1, 0], [0, 0]], [[0, M], [1, M]]),
  '9': G(1, [[1, 0], [1, T], [0, T], [0, M], [1, M]]),
  ' ': G(0.7),
  '!': G(0.35, [[0.18, T], [0.18, 0.45]], [[0.18, 0.14], [0.18, 0]]),
  '?': G(1, [[0, T - 0.25], [0, T], [1, T], [1, M + 0.05], [0.5, M - 0.1], [0.5, 0.45]], [[0.5, 0.14], [0.5, 0]]),
  "'": G(0.3, [[0.15, T], [0.15, T - 0.35]]),
  '-': G(0.8, [[0.1, M], [0.7, M]]),
};

// ---- tiny SVG path parser: M/m L/l H/h V/v C/c Q/q Z → polylines ----------
export function parseSvgPath(d: string): Pt[][] {
  const tok = d.match(/[MmLlHhVvCcQqZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  const num = () => parseFloat(tok[i++]);
  const isNum = () => i < tok.length && !/[A-Za-z]/.test(tok[i]);
  const flush = () => {
    if (cur.length > 1) polys.push(cur);
    cur = [];
  };
  // de Casteljau sampling for quadratic/cubic Béziers (12 steps)
  const bez = (ctrl: Pt[]) => {
    for (let s = 1; s <= 12; s += 1) {
      const u = s / 12;
      let ps = ctrl.map((p) => [p[0], p[1]] as Pt);
      while (ps.length > 1) {
        const nx: Pt[] = [];
        for (let k = 0; k + 1 < ps.length; k += 1) {
          nx.push([ps[k][0] + (ps[k + 1][0] - ps[k][0]) * u, ps[k][1] + (ps[k + 1][1] - ps[k][1]) * u]);
        }
        ps = nx;
      }
      x = ps[0][0];
      y = ps[0][1];
      cur.push([x, y]);
    }
  };
  while (i < tok.length) {
    const c = tok[i++];
    if (/\d|\./.test(c)) continue; // stray number without a command — skip
    const rel = c === c.toLowerCase();
    const C = c.toUpperCase();
    if (C === 'Z') {
      cur.push([sx, sy]);
      x = sx;
      y = sy;
      flush();
      continue;
    }
    if (C === 'M') {
      flush();
      const mx = num();
      const my = num();
      x = rel ? x + mx : mx;
      y = rel ? y + my : my;
      sx = x;
      sy = y;
      cur.push([x, y]);
      while (isNum()) {
        const lx = num();
        const ly = num();
        x = rel ? x + lx : lx;
        y = rel ? y + ly : ly;
        cur.push([x, y]); // implicit lineto after moveto
      }
      continue;
    }
    do {
      if (C === 'L') {
        const lx = num();
        const ly = num();
        x = rel ? x + lx : lx;
        y = rel ? y + ly : ly;
        cur.push([x, y]);
      } else if (C === 'H') {
        const lx = num();
        x = rel ? x + lx : lx;
        cur.push([x, y]);
      } else if (C === 'V') {
        const ly = num();
        y = rel ? y + ly : ly;
        cur.push([x, y]);
      } else if (C === 'C') {
        const a1 = num();
        const a2 = num();
        const b1 = num();
        const b2 = num();
        const e1 = num();
        const e2 = num();
        bez([
          [x, y],
          [rel ? x + a1 : a1, rel ? y + a2 : a2],
          [rel ? x + b1 : b1, rel ? y + b2 : b2],
          [rel ? x + e1 : e1, rel ? y + e2 : e2],
        ]);
      } else if (C === 'Q') {
        const a1 = num();
        const a2 = num();
        const e1 = num();
        const e2 = num();
        bez([
          [x, y],
          [rel ? x + a1 : a1, rel ? y + a2 : a2],
          [rel ? x + e1 : e1, rel ? y + e2 : e2],
        ]);
      }
    } while (isNum());
  }
  flush();
  return polys;
}

export interface NeonSignOpts {
  /** TEXT mode: A-Z, 0-9, space, ! ? ' -  (default 'NEON') */
  text?: string;
  /** PATH mode: an SVG path string (M/m L/l H/h V/v C/c Q/q Z) */
  path?: string;
  /** neon colour (default hot pink) */
  color?: number;
  /** second colour for alternating characters / subpaths */
  secondary?: number;
  /** overall scale — cap height is 1.5 * scale. DEFAULT: auto — 1, shrunk so
   *  the sign never exceeds ~2.5 u of width (a 7-letter marquee like
   *  "HAUNTED" would otherwise span ~8 u and dwarf a park street). An
   *  EXPLICIT scale is always honoured untouched. */
  scale?: number;
  /** dark metal backboard behind the tubes (default: on for text, off for path) */
  backboard?: boolean;
}

/** widest a DEFAULT-scaled sign may render (explicit `opts.scale` wins) */
const MAX_DEFAULT_WIDTH = 2.5;
/** largest backboard slab allowed, in u² of sign face (round-2 safeguard) —
 *  a bigger request falls back to the open rear rail */
const BACKBOARD_MAX_AREA = 4;

/** sign width at scale 1 — glyph advances for text, bbox aspect for paths */
function unitWidthOf(opts: NeonSignOpts): number {
  if (opts.path) {
    const raw = parseSvgPath(opts.path);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    raw.forEach((p) =>
      p.forEach(([px, py]) => {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }),
    );
    return maxX > minX ? ((maxX - minX) * 1.5) / Math.max(1e-6, maxY - minY) : 0;
  }
  const text = (opts.text ?? 'NEON').toUpperCase();
  const kern = 0.18;
  let adv = 0;
  Array.from(text).forEach((ch) => {
    adv += (FONT[ch] ?? FONT[' ']).w + kern;
  });
  return Math.max(0, adv - kern);
}

export function buildNeonSign(
  t: typeof THREE,
  opts: NeonSignOpts = {},
): { group: THREE.Group; update: (time: number) => void; width: number; scale: number } {
  // default scale is CAPPED by text length so long marquees stay park-sized
  // (round-1 safeguard); an explicit opts.scale is never touched
  const scale = opts.scale ?? Math.min(1, MAX_DEFAULT_WIDTH / Math.max(1e-6, unitWidthOf(opts)));
  const color = opts.color ?? 0xff2fa0;
  const secondary = opts.secondary ?? color;
  const backboard = opts.backboard ?? opts.path == null;
  const group = new t.Group();
  const coreR = 0.024 * scale;
  const haloR = 0.05 * scale;
  const standoff = 0.11 * scale;
  const DARK = 0x232428;

  // one material pair per colour slot so the flicker update is cheap
  const mkCore = (col: number) =>
    new t.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, roughness: 0.3 });
  const mkHalo = (col: number) =>
    new t.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      roughness: 1,
    });
  const slots = [{ core: mkCore(color), halo: mkHalo(color) }];
  if (secondary !== color) slots.push({ core: mkCore(secondary), halo: mkHalo(secondary) });

  // ---- gather strokes (final sign-space coords, centred on x) ----
  interface Unit {
    polys: Pt[][];
    slot: number;
  }
  const units: Unit[] = [];
  let width = 0;
  let seed = 0;
  if (opts.path) {
    for (let ci = 0; ci < opts.path.length; ci += 1) seed += opts.path.charCodeAt(ci) * ((ci % 7) + 1);
    const raw = parseSvgPath(opts.path);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    raw.forEach((p) =>
      p.forEach(([px, py]) => {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }),
    );
    const s = (1.5 * scale) / Math.max(1e-6, maxY - minY); // fit to cap height, flip y (SVG is y-down)
    width = (maxX - minX) * s;
    raw.forEach((p, pi) =>
      units.push({ polys: [p.map(([px, py]) => [(px - minX) * s - width / 2, (maxY - py) * s] as Pt)], slot: pi % slots.length }),
    );
  } else {
    const text = (opts.text ?? 'NEON').toUpperCase();
    for (let ci = 0; ci < text.length; ci += 1) seed += text.charCodeAt(ci) * ((ci % 7) + 1);
    const kern = 0.18; // cell-space gap between characters
    let adv = 0;
    const items: { g: Glyph; x0: number; slot: number }[] = [];
    Array.from(text).forEach((ch, ci) => {
      const g = FONT[ch] ?? FONT[' '];
      items.push({ g, x0: adv, slot: ci % slots.length });
      adv += g.w + kern;
    });
    width = Math.max(0, adv - kern) * scale;
    items.forEach((it) =>
      units.push({
        polys: it.g.strokes.map((st) => st.map(([px, py]) => [(it.x0 + px) * scale - width / 2, py * scale] as Pt)),
        slot: it.slot,
      }),
    );
  }

  // ---- tubes: emissive core + transparent halo per stroke ----
  const midY = M * scale;
  const pinPts: { x: number; y: number }[] = [];
  units.forEach((u) => {
    u.polys.forEach((poly) => {
      if (poly.length < 2) return;
      const path = new t.CurvePath<THREE.Vector3>();
      for (let k = 0; k + 1 < poly.length; k += 1) {
        const a = new t.Vector3(poly[k][0], poly[k][1], 0);
        const b = new t.Vector3(poly[k + 1][0], poly[k + 1][1], 0);
        if (a.distanceToSquared(b) > 1e-10) path.add(new t.LineCurve3(a, b));
      }
      if (!path.curves.length) return;
      const segs = Math.min(220, Math.max(4, poly.length * 6));
      const core = new t.Mesh(new t.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segs, coreR, 8, false), slots[u.slot].core);
      const halo = new t.Mesh(new t.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segs, haloR, 8, false), slots[u.slot].halo);
      halo.renderOrder = 2;
      group.add(core, halo);
      // stand-off pin anchor: the stroke point nearest mid-height
      let best = poly[0];
      poly.forEach((p) => {
        if (Math.abs(p[1] - midY) < Math.abs(best[1] - midY)) best = p;
      });
      pinPts.push({ x: best[0], y: best[1] });
    });
  });

  // ---- mounting: backboard (or open rear rail) + stand-off pins ----
  const pinR = 0.012 * scale;
  const pinBetween = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = new t.Vector3().subVectors(b, a);
    const len = d.length();
    const m = new t.Mesh(new t.CylinderGeometry(pinR, pinR, len, 6), mat(t, DARK, { rough: 0.55, metal: 0.5 }));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new t.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true;
    return m;
  };
  // backboard hugs the text (round-2 safeguard): ~0.15 × cap-height padding
  // and a THIN slab — the old width+0.6 × 2.1·scale slab on a long marquee
  // filled whole ground-level shots with black. Over the area cap the sign
  // falls back to the open rear rail (a wall-sized backboard is never right).
  const openRail = () => {
    // open rear rail across the back at mid-height; angled pins to each tube
    group.add(box(t, [width + 0.3 * scale, 0.05 * scale, 0.05 * scale], DARK, [0, midY, -standoff], { tex: 'metal', rough: 0.6, metal: 0.5 }));
    pinPts.forEach((p) => group.add(pinBetween(new t.Vector3(p.x, p.y, 0), new t.Vector3(p.x, midY, -standoff))));
  };
  const pad = 0.15 * T * scale; // 0.15 × the cap height
  const bw = width + 2 * pad;
  const bh = T * scale + 2 * pad;
  if (backboard && bw * bh > BACKBOARD_MAX_AREA) {
    console.info(
      `[NeonSign] backboard ${bw.toFixed(1)}×${bh.toFixed(1)} u exceeds the ${BACKBOARD_MAX_AREA} u² area cap — mounting on the open rear rail instead (shrink the sign or split the text to keep a backboard)`,
    );
  }
  if (backboard && bw * bh <= BACKBOARD_MAX_AREA) {
    group.add(box(t, [bw, bh, 0.04 * scale], 0x1d1e22, [0, midY, -standoff - 0.02 * scale], { tex: 'metal', rough: 0.6, metal: 0.5 }));
    pinPts.forEach((p) => group.add(pinBetween(new t.Vector3(p.x, p.y, 0), new t.Vector3(p.x, p.y, -standoff))));
  } else {
    openRail();
  }

  // ONE real light tinted to the neon colour, just in front of the sign
  const pl = new t.PointLight(color, 0, Math.max(3, width * 1.8), 2);
  pl.position.set(0, midY, 0.5 * scale + 0.2);
  group.add(pl);

  const update = (time: number) => {
    const k = smooth(nightKOf(group));
    // day ≈ 12% residual glow (round-2 safeguard: tubes read as unlit glass
    // in daylight — pink day-glow looked like an always-on lamp), full neon
    // at night (same night level as before)
    const base = 0.12 + 1.13 * k;
    slots.forEach((s, si) => {
      // occasional hashed flicker dips (per colour slot, deterministic)
      const slot9 = Math.floor(time * 9);
      const dip = hash01(slot9 * 13.7 + seed + si * 57) < 0.06 ? 0.3 : 1;
      const shimmer = 1 + 0.045 * Math.sin(time * 27 + seed + si * 3);
      const glow = base * dip * shimmer;
      s.core.emissiveIntensity = 1.9 * glow;
      s.halo.emissiveIntensity = 1.1 * glow;
      s.halo.opacity = 0.04 + 0.2 * k * dip; // faint by day, full halo at night
      if (si === 0) pl.intensity = k * 1.4 * dip;
    });
  };

  return { group, update, width, scale };
}

// five-point star outline (exercises M / L / H / Z)
const STAR = 'M 50 4 L 61 36 H 95 L 68 56 L 78 90 L 50 70 L 22 90 L 32 56 L 5 36 H 39 Z';

// Two signs on the Stage: "OPEN" in pink over a dark backboard on a two-post
// frame, and a cyan SVG-path star on a single pole — both turned square to the
// fixed 45° camera so the tube lettering stays legible day and night.
export function buildNeonSignScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        const IRON = 0x26272c;
        const updaters: ((time: number) => void)[] = [];

        // --- "OPEN" over a backboard, bolted between two ground posts ---
        const c1 = new t.Group();
        const open = buildNeonSign(t, { text: 'OPEN', color: 0xff2fa0, scale: 0.55, backboard: true });
        open.group.position.set(0, 1.45, 0);
        c1.add(open.group);
        updaters.push(open.update);
        const px = open.width / 2 + 0.28;
        [-1, 1].forEach((s) => {
          c1.add(cyl(t, 0.05, 0.065, 2.62, IRON, [s * px, 1.31, -0.08], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.6 }));
          c1.add(cyl(t, 0.12, 0.15, 0.06, IRON, [s * px, 0.03, -0.08], { rough: 0.6, metal: 0.4 }));
        });
        c1.add(box(t, [px * 2 + 0.14, 0.08, 0.08], IRON, [0, 2.62, -0.08], { tex: 'metal', rough: 0.55, metal: 0.6 }));
        c1.position.set(-1.2, 0, 1.2);
        c1.rotation.y = Math.PI / 4; // face the fixed 45° camera square-on
        g.add(c1);

        // --- cyan star outline on a single pole (open rail mount) ---
        const c2 = new t.Group();
        const star = buildNeonSign(t, { path: STAR, color: 0x22d8e8, scale: 0.9, backboard: false });
        star.group.position.set(0, 1.35, 0);
        c2.add(star.group);
        updaters.push(star.update);
        // pole up to the sign's rear rail (rail sits at local y 0.675, z -0.099)
        c2.add(cyl(t, 0.05, 0.07, 2.02, IRON, [0, 1.01, -0.099], { tex: 'metal', repeat: [1, 4], rough: 0.55, metal: 0.6 }));
        c2.add(cyl(t, 0.14, 0.18, 0.07, IRON, [0, 0.035, -0.099], { rough: 0.6, metal: 0.4 }));
        c2.position.set(1.6, 0, -1.6);
        c2.rotation.y = Math.PI / 4; // face the fixed 45° camera square-on
        g.add(c2);

        return (time) => updaters.forEach((u) => u(time));
      })(three, group) || undefined;
  return { group, update };
}

/** <NeonSign> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const NeonSign = composable('NeonSign', (t) => buildNeonSignScene(t));

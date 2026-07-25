import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, nightKOf } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// RideEntrance — the classic RCT2 ride ENTRANCE / EXIT hut: a compact
// peaked-roof pass-through booth (dark wood posts, cream walls, saddle roof
// with its RIDGE along the walk axis so a real GABLE faces the queue).
// The ENTRANCE kind carries RCT2's tall decorative FALSE FRONT: a stepped
// marquee board raised over the front gable, rising well ABOVE the roof
// ridge, with the green sign band mounted high on the board and a small lamp
// finial on top; the EXIT kind keeps a low plain front with a red band hung
// on struts at lintel height. Both bands now carry a recessed LED DOT-MATRIX
// screen (ledScreenTexture below) reading "ENTRANCE" / "EXIT" — a procedural
// CanvasTexture (dark bezel + a full pixel/dot grid, lit pixels forming a
// hand-built 5×7 glyph font, no fillText/font dependency) applied as both
// map and emissiveMap so the sign reads as painted colour by day and glows
// by night, gated by nightKOf exactly like every other lamp in this file.
// Both doorways (front +z and back −z) are open so a peep can walk straight
// through onto the ride platform, over small concrete aprons that bridge the
// hut base to the queue lane.
// ---------------------------------------------------------------------------

export interface RideEntranceOpts {
  kind?: 'entrance' | 'exit';
}

/** Local walk-through point at ground level in front of the hut (+z). */
export const ENTRANCE_DOORWAY: [number, number, number] = [0, 0, 0.66];

// ---------------------------------------------------------------------------
// LED dot-matrix screen — a hand-built 5×7 pixel font (same spirit as
// NeonSign's vector font: draw the glyphs yourself, no canvas fillText / font
// dependency) rasterised into a procedural CanvasTexture: a dark bezel with a
// deterministic (hashed-sine) speckle, and a FULL grid of pixel squares
// spanning the whole screen — lit squares form the word, unlit squares stay
// as dim phosphor dots — so it always reads as one continuous LED panel, not
// just a lit patch. The texture is cached module-level per word+colour and
// used as BOTH map (so the sign shows its printed colour under any light)
// and emissiveMap (so only the lit pixels bloom once nightKOf ramps up).
// ---------------------------------------------------------------------------
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 47.13) * 43758.5453;
  return s - Math.floor(s);
};

/** 5 cols × 7 rows per glyph, top row first — only the letters ENTRANCE/EXIT need. */
const DOT_FONT: Record<string, string[]> = {
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  A: ['01110', '10001', '10001', '10001', '11111', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const _ledTexCache = new Map<string, THREE.CanvasTexture>();

/** grid size, in cells, for `word` — lets callers pick a plane size that
 *  matches the canvas aspect exactly (no pixel stretching). Pure function of
 *  `word`, so it is safe to recompute wherever the texture is looked up. */
function ledGridOf(word: string): [number, number] {
  const chars = Array.from(word.toUpperCase());
  const glyphCols = 5;
  const charGap = 1;
  const marginCols = 2;
  const marginRows = 1;
  const totalCols = chars.length * glyphCols + Math.max(0, chars.length - 1) * charGap;
  return [totalCols + marginCols * 2, 7 + marginRows * 2];
}

function ledScreenTexture(t: typeof THREE, word: string, ledColor: number): THREE.CanvasTexture {
  const key = `${word}:${ledColor}`;
  const hit = _ledTexCache.get(key);
  if (hit) return hit;

  const CELL = 18; // px per LED pixel — chunky and legible at hut scale
  const GAP = 2; // gutter drawn inside each cell so pixels read as discrete dots
  const chars = Array.from(word.toUpperCase());
  const glyphCols = 5;
  const charGap = 1;
  const marginCols = 2;
  const marginRows = 1;
  const [gridCols, gridRows] = ledGridOf(word);

  // build the on/off pixel grid first so every cell (glyph or margin) is
  // drawn through the same loop below — keeps the whole panel one grid
  const onGrid: boolean[][] = Array.from({ length: gridRows }, () => new Array(gridCols).fill(false));
  chars.forEach((ch, ci) => {
    const bits = DOT_FONT[ch] ?? DOT_FONT[' '];
    for (let ry = 0; ry < 7; ry += 1) {
      for (let cx = 0; cx < glyphCols; cx += 1) {
        if (bits[ry][cx] === '1') {
          onGrid[marginRows + ry][marginCols + ci * (glyphCols + charGap) + cx] = true;
        }
      }
    }
  });

  const W = gridCols * CELL;
  const H = gridRows * CELL;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;

  // dark screen bezel: vertical sheen + deterministic hashed-sine speckle
  const grad = x.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#161b18');
  grad.addColorStop(0.5, '#0b0f0d');
  grad.addColorStop(1, '#050807');
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i += 1) {
    x.fillStyle = hash01(i * 7 + 3) > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    x.fillRect(hash01(i * 3 + 11) * W, hash01(i * 5 + 19) * H, 2, 2);
  }
  x.strokeStyle = 'rgba(0,0,0,0.65)';
  x.lineWidth = 4;
  x.strokeRect(2, 2, W - 4, H - 4);

  const onCol = `#${(ledColor & 0xffffff).toString(16).padStart(6, '0')}`;
  const offCol = 'rgba(255,255,255,0.05)'; // dim unlit phosphor dot

  for (let gy = 0; gy < gridRows; gy += 1) {
    for (let gx = 0; gx < gridCols; gx += 1) {
      const px = gx * CELL + GAP;
      const py = gy * CELL + GAP;
      const s = CELL - GAP * 2;
      x.fillStyle = onGrid[gy][gx] ? onCol : offCol;
      x.fillRect(px, py, s, s);
    }
  }

  const tex = new t.CanvasTexture(c);
  tex.anisotropy = 4;
  (tex as unknown as { colorSpace: string }).colorSpace = (t as unknown as { SRGBColorSpace: string }).SRGBColorSpace;
  _ledTexCache.set(key, tex);
  return tex;
}

/** Mount a recessed, flush LED screen (map + emissiveMap, nightK-gated) at
 *  `center` sized to `width` × (width / gridAspect) so pixels stay square. */
function mountLedScreen(
  t: typeof THREE,
  g: THREE.Group,
  word: string,
  ledColor: number,
  center: [number, number, number],
  width: number,
): void {
  const tex = ledScreenTexture(t, word, ledColor);
  const [gridCols, gridRows] = ledGridOf(word);
  const height = width * (gridRows / gridCols);
  const screenMat = new t.MeshStandardMaterial({
    map: tex,
    emissive: ledColor,
    emissiveMap: tex,
    emissiveIntensity: 0.16,
    roughness: 0.5,
    metalness: 0.05,
  });
  const screen = new t.Mesh(new t.PlaneGeometry(width, height), screenMat);
  screen.position.set(...center);
  screen.receiveShadow = true;
  g.add(screen);
  screen.onBeforeRender = () => {
    const k = nightKOf(screen);
    const ease = k * k * (3 - 2 * k); // smoothstep
    screenMat.emissiveIntensity = 0.16 + 2.1 * ease;
  };
}

export function buildRideEntrance(
  t: typeof THREE,
  opts: RideEntranceOpts = {},
): { group: THREE.Group; doorway: [number, number, number] } {
  const kind = opts.kind ?? 'entrance';
  const g = new t.Group();

  const POST = 0x4a3826; // dark stained timber
  const WALL = 0xe8e2d2; // cream panels
  const ROOF = 0x5b432c; // shingle-brown saddle roof
  const TRIM = 0x3a2c1c;
  const BAND = kind === 'entrance' ? 0x1f6b33 : 0x8f2723; // green / red sign band
  const PALE = 0xf2f2ec;

  const W = 0.95; // width (x)
  const D = 0.8; // depth (z) — walk-through axis
  const wallH = 0.78;
  const doorW = 0.42;

  // concrete base slab + doorway aprons that abut it exactly (front and back)
  // so the hut base always reaches the queue lane / unload strip — no grass gap
  g.add(box(t, [W + 0.14, 0.08, D + 0.14], 0x9a978e, [0, 0.04, 0], { tex: 'concrete', repeat: [3, 3], rough: 0.95 }));
  [-1, 1].forEach((zs) =>
    g.add(box(t, [doorW + 0.34, 0.08, 0.2], 0x9a978e, [0, 0.04, zs * (D / 2 + 0.17)], { tex: 'concrete', repeat: [3, 1], rough: 0.95 })),
  );

  // four corner posts
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([sx, sz]) =>
    g.add(
      box(t, [0.08, wallH + 0.08, 0.08], POST, [sx * (W / 2 - 0.05), 0.08 + (wallH + 0.08) / 2, sz * (D / 2 - 0.05)], {
        tex: 'wood',
        repeat: [1, 3],
        rough: 0.9,
      }),
    ),
  );

  // full side walls + timber top plates sealing the strip under the eaves
  [-1, 1].forEach((s) => {
    g.add(
      box(t, [0.06, wallH - 0.06, D - 0.14], WALL, [s * (W / 2 - 0.05), 0.08 + (wallH - 0.06) / 2, 0], {
        tex: 'concrete',
        repeat: [2, 2],
        rough: 0.9,
      }),
    );
    g.add(box(t, [0.06, 0.06, D - 0.14], POST, [s * (W / 2 - 0.05), 0.08 + wallH - 0.03, 0], { tex: 'wood', repeat: [1, 2], rough: 0.9 }));
  });

  // front and back walls, each with an open doorway gap in the middle
  const sideW = (W - doorW) / 2 - 0.09;
  [-1, 1].forEach((zs) =>
    [-1, 1].forEach((xs) =>
      g.add(
        box(t, [sideW, wallH - 0.06, 0.06], WALL, [xs * (doorW / 2 + sideW / 2), 0.08 + (wallH - 0.06) / 2, zs * (D / 2 - 0.04)], {
          tex: 'concrete',
          repeat: [2, 2],
          rough: 0.9,
        }),
      ),
    ),
  );
  // timber lintels over both doorways
  [-1, 1].forEach((zs) =>
    g.add(box(t, [doorW + 0.18, 0.1, 0.08], POST, [0, 0.08 + wallH - 0.05, zs * (D / 2 - 0.04)], { tex: 'wood', repeat: [2, 1], rough: 0.9 })),
  );

  // saddle roof: RIDGE ALONG Z (the walk axis) so both gable triangles face
  // the doorways — panels slope in ±x from the ridge down to the side eaves.
  // The ENTRANCE roof is TRIMMED at the front (panels end at z = 0.42, not
  // 0.6) so the raked edge tucks BEHIND the false-front board (z 0.43..0.49)
  // instead of jutting through it; the exit keeps the symmetric overhang.
  const eaveY = 0.08 + wallH;
  const pitch = kind === 'entrance' ? 0.5 : 0.4; // false front dominates the entrance
  const panelLen = (W / 2 + 0.2) / Math.cos(pitch);
  const ridgeY = eaveY + Math.sin(pitch) * panelLen; // entrance ≈ 1.23, exit ≈ 1.15
  const roofD = kind === 'entrance' ? D + 0.22 : D + 0.4;
  const roofZ = kind === 'entrance' ? -0.09 : 0; // entrance panels span z −0.6..0.42
  [-1, 1].forEach((sx) =>
    g.add(
      box(t, [panelLen, 0.045, roofD], ROOF, [(sx * Math.cos(pitch) * panelLen) / 2, eaveY + (Math.sin(pitch) * panelLen) / 2, roofZ], {
        tex: 'wood',
        repeat: [2, 4],
        rough: 0.9,
        rotZ: -sx * pitch,
      }),
    ),
  );
  // ridge beam caps the join. On the ENTRANCE its front end is TUCKED to
  // z = 0.4175 — just inside the trimmed roof panels (z ≤ 0.42) and 12 mm
  // clear of the false-front board's back face (z = 0.43), which it used to
  // touch exactly (coplanar z-fighting patch on the board back); the back
  // keeps the 22 mm overhang. The exit beam overhangs both gables as before.
  const beamD = kind === 'entrance' ? roofD + 0.02 : roofD + 0.04;
  const beamZ = kind === 'entrance' ? roofZ - 0.0125 : roofZ;
  g.add(box(t, [0.1, 0.06, beamD], TRIM, [0, ridgeY + 0.01, beamZ], { tex: 'wood', repeat: [1, 4], rough: 0.9 }));

  // solid gable infill at BOTH ends (no see-through attic): a thin extruded
  // triangle matching the roof pitch, sitting on the lintel/eave line
  const gs = new t.Shape();
  gs.moveTo(-(W / 2 + 0.02), 0);
  gs.lineTo(W / 2 + 0.02, 0);
  gs.lineTo(0, ridgeY - eaveY - 0.02);
  const gableGeo = new t.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: false });
  [-1, 1].forEach((zs) => {
    const gable = new t.Mesh(gableGeo, mat(t, WALL, { tex: 'concrete', repeat: [2, 1], rough: 0.9 }));
    // inset 5mm behind the corner-post faces so no face is coplanar
    gable.position.set(0, eaveY - 0.02, zs * (D / 2 - 0.045) - 0.03);
    gable.castShadow = true;
    gable.receiveShadow = true;
    g.add(gable);
  });

  if (kind === 'entrance') {
    // ---- RCT2 tall FALSE FRONT: a stepped marquee board raised over the
    // front gable, rising above the roof ridge. Anchor chain (nothing floats,
    // nothing clips — arithmetic, THICKNESS-AWARE: the roof underside runs
    // ~26 mm below the panel midline, i.e. underside y ≈ 1.034 at |x| = 0.31
    // and ≈ 1.094 at |x| = 0.20): gable front face z ≈ 0.385 ← step1
    // (z 0.38..0.48, y 0.86..1.02, |x| ≤ 0.31 — 14 mm under the roof skin)
    // ← step2 (z 0.38..0.48, y 0.98..1.08, |x| ≤ 0.20 — its old 1.10 top
    // poked THROUGH the underside) ← board tiers (z 0.43..0.49, bottom
    // y 1.04 — overlaps step2, clears a walking peep's head, and sits fully
    // in FRONT of the trimmed roof panels which end at z = 0.42). Doorway
    // [0,0,0.66] untouched: the proudest element (sign bars, z ≤ 0.555)
    // stays behind it and above 1.0.
    g.add(box(t, [0.62, 0.16, 0.1], WALL, [0, eaveY + 0.08, 0.43], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
    g.add(box(t, [0.4, 0.1, 0.1], WALL, [0, eaveY + 0.17, 0.43], { tex: 'wood', repeat: [2, 1], rough: 0.9 }));
    // false-front tiers: wide base board, shoulder, cap — a stepped skyline
    g.add(box(t, [0.98, 0.32, 0.06], WALL, [0, 1.2, 0.46], { tex: 'wood', repeat: [4, 2], rough: 0.9 }));
    g.add(box(t, [0.64, 0.22, 0.06], WALL, [0, 1.47, 0.46], { tex: 'wood', repeat: [3, 1], rough: 0.9 }));
    g.add(box(t, [0.34, 0.08, 0.06], WALL, [0, 1.62, 0.46], { rough: 0.9 }));
    g.add(box(t, [0.38, 0.04, 0.07], TRIM, [0, 1.68, 0.46], { tex: 'wood', repeat: [2, 1], rough: 0.9 })); // coping
    // timber edge trim down the base board sides
    [-1, 1].forEach((s) => g.add(box(t, [0.05, 0.34, 0.064], TRIM, [s * 0.475, 1.2, 0.46], { tex: 'wood', repeat: [1, 2], rough: 0.9 })));
    // GREEN sign band high on the base board — white frame stripes act as the
    // cabinet bezel; the word itself is a recessed LED dot-matrix screen (see
    // mountLedScreen above), flush with the band face (0.525) and tucked
    // 1 mm under the frame stripes' proud lip (0.527) so it reads as inset.
    g.add(box(t, [0.86, 0.3, 0.05], BAND, [0, 1.2, 0.5], { rough: 0.55 }));
    [1, -1].forEach((s) => g.add(box(t, [0.88, 0.028, 0.054], PALE, [0, 1.2 + s * 0.125, 0.5], { rough: 0.55 })));
    mountLedScreen(t, g, 'ENTRANCE', 0x39ff6a, [0, 1.2, 0.526], 0.8);
    // lamp finial on the cap so the marquee reads at night (clear of heads):
    // emissive + ONE warm sign light gated by nightKOf via onBeforeRender
    // (the { group, doorway } contract carries no update fn)
    g.add(cyl(t, 0.024, 0.032, 0.05, TRIM, [0, 1.725, 0.46], { rough: 0.6, seg: 8 }));
    const finial = ball(t, 0.035, 0xffe9a8, [0, 1.775, 0.46], { emissive: 0xffc76a, rough: 0.4 });
    const finialMat = finial.material as THREE.MeshStandardMaterial;
    finialMat.emissiveIntensity = 0.25;
    g.add(finial);
    const signLight = new t.PointLight(0xffd98c, 0, 3, 2);
    signLight.position.set(0, 1.45, 0.9);
    g.add(signLight);
    finial.onBeforeRender = () => {
      const k = nightKOf(finial);
      const ease = k * k * (3 - 2 * k); // smoothstep
      finialMat.emissiveIntensity = 0.25 + 2.1 * ease;
      signLight.intensity = ease * 0.9;
    };
  } else {
    // ---- EXIT: low plain front — a red band hung over the doorway on struts
    // that pass through the front wall into the board, anchored at both ends.
    // signY keeps the band TOP (0.92) tucked well under the roof's front rake
    // silhouette (top surface ≈ 0.996 at the band ends, |x| = 0.41) so no red
    // sliver ever peeks over the roof edge, even from high back angles.
    const signY = 0.8;
    const signH = 0.24;
    const signZ = D / 2 + 0.24;
    [-1, 1].forEach((s) => g.add(box(t, [0.05, 0.05, 0.28], TRIM, [s * 0.3, signY - 0.06, 0.49], { rough: 0.8 })));
    g.add(box(t, [0.8, signH, 0.07], BAND, [0, signY, signZ], { rough: 0.55 }));
    [1, -1].forEach((s) => g.add(box(t, [0.82, 0.028, 0.074], PALE, [0, signY + s * (signH / 2 - 0.025), signZ], { rough: 0.55 })));
    // the word is a recessed LED dot-matrix screen (see mountLedScreen
    // above), flush with the band face (signZ + 0.035) and tucked under the
    // frame stripes' proud lip (signZ + 0.037)
    mountLedScreen(t, g, 'EXIT', 0xff3b30, [0, signY, signZ + 0.036], 0.52);
    // small lamp finial on TOP of the sign band (moved off the band's
    // underside so half-scale guests walking the doorway clear it, and its
    // glow ball hides under the centre of the roof rake, y ≤ 1.03 vs ≈ 1.17)
    // — emissive + ONE warm doorway light gated by nightKOf via onBeforeRender
    g.add(cyl(t, 0.028, 0.034, 0.05, TRIM, [0, signY + signH / 2 + 0.025, signZ], { rough: 0.6, seg: 8 }));
    const exitLamp = ball(t, 0.032, 0xffe9a8, [0, signY + signH / 2 + 0.075, signZ], { emissive: 0xffc76a, rough: 0.4 });
    const exitLampMat = exitLamp.material as THREE.MeshStandardMaterial;
    exitLampMat.emissiveIntensity = 0.25;
    g.add(exitLamp);
    const doorLight = new t.PointLight(0xffd98c, 0, 2.6, 2);
    doorLight.position.set(0, 0.8, signZ + 0.28);
    g.add(doorLight);
    exitLamp.onBeforeRender = () => {
      const k = nightKOf(exitLamp);
      const ease = k * k * (3 - 2 * k); // smoothstep
      exitLampMat.emissiveIntensity = 0.25 + 2.1 * ease;
      doorLight.intensity = ease * 0.75;
    };
  }

  return { group: g, doorway: [...ENTRANCE_DOORWAY] as [number, number, number] };
}

// Preview: entrance + exit huts side by side, a guest walking through the
// entrance doorway on a loop (both doorways are open — it's a pass-through).
export function buildRideEntranceScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // spread the huts along the screen-x diagonal of the fixed 45° camera
        const ent = buildRideEntrance(t, { kind: 'entrance' });
        ent.group.position.set(-0.85, 0, 0.85);
        g.add(ent.group);
        const ex = buildRideEntrance(t, { kind: 'exit' });
        ex.group.position.set(0.95, 0, -0.95);
        g.add(ex.group);

        const p = buildPeep(t, { expression: 'happy' });
        p.group.scale.setScalar(0.5);
        g.add(p.group);

        return (time) => {
          const span = 3.4;
          const u = (time * 0.3) % 1;
          const z = 0.85 + 1.7 - u * span; // front → through the entrance doorway → out the back
          p.walk(time * 1.5, 0); // walk() sets the bob y — lift onto the slab after
          p.group.position.set(-0.85, 0.08 + p.group.position.y, z);
          p.group.rotation.y = Math.PI; // facing −z, into the hut
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <RideEntrance> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const RideEntrance = composable('RideEntrance', (t) => buildRideEntranceScene(t));

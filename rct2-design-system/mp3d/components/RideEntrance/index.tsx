import React from 'react';
import * as THREE from 'three';
import { box, cyl, ball, mat, mtx, mergedBoxes, mergedParts, nightKOf, type MergedBoxSpec } from '../Stage';
import { buildPeep } from '../Guest';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// RideEntrance — the classic RCT2 ride ENTRANCE / EXIT hut: one small, neat,
// SYMMETRICAL gateway building, built once and dressed twice.
//
// MASSING (round-9 rebuild — the old hut was a grey ziggurat of plain boxes
// stacked 2.3× the wall height over a 0.78 hut, with the roof panels trimmed
// asymmetrically so from a three-quarter view they read as two loose diagonal
// planks). The rule now: the sign belongs ON the building.
//
//   • ONE hut shell for both kinds — slab + kerb, four corner posts with base
//     blocks and capitals, panelled walls with battens, framed doorways front
//     (+z) and back (−z), a continuous timber head beam over each doorway.
//   • ONE roof for both kinds: a saddle roof, ridge along z (the walk axis) so
//     a real GABLE faces the queue, pitch 0.52, and a fully SYMMETRIC overhang
//     — 0.13 past the wall line in ±x, 0.08 past the gable walls in ±z. It is
//     dressed as a roof, not a plank: shingle course lips, eave fascias, rake
//     (barge) boards standing proud along both gable edges, a ridge cap.
//   • ONE marquee frame for both kinds: a timber SHELF on two knee braces
//     carried off the head beam and the front capitals, a scalloped valance
//     hanging under it, and a sign board standing on the shelf, framed by
//     pilasters and capped by a cornice rail. The board tops out at 1.14
//     (1.45 × wall height) — the roof ridge at 1.21/1.24 is still the tallest
//     thing on the hut, so the silhouette is HUT, not billboard.
//   • The ENTRANCE is the dressed sibling: taller board, green band, a stepped
//     centre crest under the ridge and a row of nine marquee bulbs. The EXIT is
//     the plain sibling: same shell, same roof, same shelf, lower board, red
//     band, one small bracket lamp. Green + crest = entrance, red + plain =
//     exit, at a glance, and they read as a pair.
//
// Both bands carry a recessed LED DOT-MATRIX screen (ledScreenTexture below)
// reading "ENTRANCE" / "EXIT" — a procedural CanvasTexture (dark bezel + a full
// pixel/dot grid, lit pixels forming a hand-built 5×7 glyph font, no
// fillText/font dependency) applied as both map and emissiveMap so the sign
// reads as painted colour by day and glows by night, gated by nightKOf exactly
// like every lamp in this file. Sized to the BAND now, not to the hut.
//
// Both doorways stay open so a peep walks straight through onto the ride
// platform, over small concrete aprons that bridge the hut base to the queue
// lane. `ENTRANCE_DOORWAY` and the audited footprint (slab 1.09 × 0.94) are
// unchanged by the rebuild — every park's queue geometry keys off them.
// ---------------------------------------------------------------------------

export interface RideEntranceOpts {
  kind?: 'entrance' | 'exit';
}

/** Local walk-through point at ground level in front of the hut (+z). */
export const ENTRANCE_DOORWAY: [number, number, number] = [0, 0, 0.66];

/**
 * THE HUT'S APRON LEVEL — the top of its base slab, and the height a guest
 * standing in its doorway is at.
 *
 * It is the SHARED PATH COURSE (`PathNetwork`'s `PATH_H`), and it has to be:
 * the hut always abuts pavement on both faces — a queue lane at the front
 * doorway, an unload strip or an exit footpath at the back — and both of those
 * finish at `PATH_H` above their own datum. The slab was 0.08 while the paths
 * were 0.09, so every ride in the park had a 1 cm lip where its queue met its
 * entrance hut and where its exit path left the exit hut: MEASURED at +0.0071
 * to +0.0108 u across six rides, i.e. constant, i.e. a datum mismatch rather
 * than a layout one (harness/mp3d-render/probe-lane-joins.mjs).
 *
 * The whole shell derives from it (`eaveY = slabH + wallH`), so raising it
 * lifts the hut 1 cm intact — the audited XZ footprint (1.09 × 0.94, hutRect)
 * is untouched.
 */
export const HUT_APRON_Y = 0.09;

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
  const isEnt = kind === 'entrance';
  const g = new t.Group();

  const POST = 0x4a3826; // dark stained timber
  const WALL = 0xe8e2d2; // cream panels
  const ROOF = 0x5b432c; // shingle-brown saddle roof
  const TRIM = 0x3a2c1c;
  const BAND = isEnt ? 0x1f6b33 : 0x8f2723; // green / red sign band
  const PALE = 0xf2f2ec;
  const SLAB = 0x9a978e;

  // ---- the shell. W/D/wallH/doorW and the slab are the PUBLIC footprint:
  // GameManager's hutRect audits 1.10 × 1.00 around the hut centre and
  // ENTRANCE_DOORWAY sits on the +z apron. Do not resize these.
  const W = 0.95; // width (x)
  const D = 0.8; // depth (z) — walk-through axis
  const wallH = 0.78;
  const doorW = 0.42;
  const slabH = HUT_APRON_Y; // == PathNetwork's PATH_H — see HUT_APRON_Y
  const eaveY = slabH + wallH; // 0.87 — top of the wall plate ring

  // ---- the roof, derived once and shared by both kinds. SYMMETRIC in x AND
  // z: no trimmed front, no tucked ridge beam — the marquee stands clear in
  // FRONT of the front rake instead of being buried in it, which is what let
  // the old asymmetric trims (roofZ −0.09, roofD D+0.22, the 12 mm beam tuck)
  // be deleted outright.
  const PITCH = 0.52;
  const X_OVER = 0.13; // overhang past the wall line, both sides
  const Z_OVER = 0.08; // overhang past the gable walls, both ends
  const halfSpan = W / 2 + X_OVER; // 0.605
  const panelLen = halfSpan / Math.cos(PITCH); // 0.697
  const ridgeY = eaveY + Math.sin(PITCH) * panelLen; // 1.206
  const roofD = D + 2 * Z_OVER; // 0.96 — panels span z ±0.48
  const roofT = 0.038;
  /** vertical drop from a panel's MIDLINE to its underside */
  const underDrop = roofT / 2 / Math.cos(PITCH);
  /** roof underside height at |x| — every part tucked under the eaves is
   *  measured against THIS, not against the ridge (the old hut's stack of
   *  boards poked through the skin twice before it was measured properly). */
  const underAt = (x: number) => eaveY + (halfSpan - Math.abs(x)) * Math.tan(PITCH) - underDrop;
  /** point on a panel's midline, `d` along the slope from the ridge */
  const slopePt = (sx: number, d: number): [number, number] => [sx * Math.cos(PITCH) * d, ridgeY - Math.sin(PITCH) * d];
  /** unit normal of a panel's top surface */
  const slopeN = (sx: number): [number, number] => [sx * Math.sin(PITCH), Math.cos(PITCH)];

  const CORNERS: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];

  // ---- ground: base slab, the two doorway aprons that abut it exactly (so
  // the hut always reaches the queue lane / unload strip — no grass gap) and a
  // kerb rim. The kerb skips the apron mouths so nothing crosses the walk line.
  const ground: MergedBoxSpec[] = [
    { dims: [W + 0.14, slabH, D + 0.14], pos: [0, slabH / 2, 0], repeat: [3, 3] },
    ...[-1, 1].map((zs) => ({ dims: [doorW + 0.34, slabH, 0.2] as [number, number, number], pos: [0, slabH / 2, zs * (D / 2 + 0.17)] as [number, number, number], repeat: [3, 1] as [number, number] })),
    ...[-1, 1].map((sx) => ({ dims: [0.03, 0.016, D + 0.14] as [number, number, number], pos: [sx * (W / 2 + 0.055), slabH + 0.008, 0] as [number, number, number], repeat: [1, 4] as [number, number] })),
    ...[-1, 1].flatMap((zs) =>
      [-1, 1].map((sx) => ({
        dims: [0.155, 0.016, 0.03] as [number, number, number],
        pos: [sx * 0.465, slabH + 0.008, zs * (D / 2 + 0.055)] as [number, number, number],
      })),
    ),
  ];
  const groundMesh = mergedBoxes(t, ground, SLAB, { tex: 'concrete', rough: 0.95 });
  groundMesh.name = 'hutGround'; // the apron a queue lane / exit path butts against
  g.add(groundMesh);

  // ---- structural timber: corner posts (base block + capital), the side wall
  // top plates and a FULL-WIDTH head beam over each doorway. The head beam
  // replaces the old short lintel, which left an open 60 × 175 mm notch above
  // each front wall panel between the lintel and the gable.
  const frame: MergedBoxSpec[] = [];
  CORNERS.forEach(([sx, sz]) => {
    const px = sx * (W / 2 - 0.05);
    const pz = sz * (D / 2 - 0.05);
    frame.push({ dims: [0.08, wallH, 0.08], pos: [px, slabH + wallH / 2, pz], repeat: [1, 3] });
    frame.push({ dims: [0.1, 0.04, 0.1], pos: [px, slabH + 0.02, pz] }); // base block
    // capital: 0.865 top, a clear 47 mm under the roof skin at |x| = 0.475
    frame.push({ dims: [0.1, 0.04, 0.1], pos: [px, eaveY - 0.015, pz] });
  });
  [-1, 1].forEach((s) => frame.push({ dims: [0.06, 0.06, D - 0.14], pos: [s * (W / 2 - 0.05), eaveY - 0.03, 0], repeat: [1, 2] }));
  [-1, 1].forEach((zs) => frame.push({ dims: [0.79, 0.07, 0.075], pos: [0, eaveY - 0.025, zs * (D / 2 - 0.0375)], repeat: [3, 1] }));
  g.add(mergedBoxes(t, frame, POST, { tex: 'wood', rough: 0.9 }));

  // ---- cream wall panels: full side walls plus the two flanks of each
  // doorway. Everything tops out at 0.80, under the head/plate ring.
  const sideW = (W - doorW) / 2 - 0.09;
  const walls: MergedBoxSpec[] = [
    ...[-1, 1].map((s) => ({ dims: [0.06, wallH - 0.06, D - 0.14] as [number, number, number], pos: [s * (W / 2 - 0.05), slabH + (wallH - 0.06) / 2, 0] as [number, number, number], repeat: [2, 2] as [number, number] })),
    ...[-1, 1].flatMap((zs) =>
      [-1, 1].map((xs) => ({
        dims: [sideW, wallH - 0.06, 0.06] as [number, number, number],
        pos: [xs * (doorW / 2 + sideW / 2), slabH + (wallH - 0.06) / 2, zs * (D / 2 - 0.04)] as [number, number, number],
        repeat: [2, 2] as [number, number],
      })),
    ),
  ];
  g.add(mergedBoxes(t, walls, WALL, { tex: 'concrete', rough: 0.9 }));

  // ---- fine timber: doorway jambs + wall battens. Tagged lodDetail — it is
  // the boarded-wall read at close range, worth nothing at park distance.
  const battens: MergedBoxSpec[] = [];
  [-1, 1].forEach((zs) =>
    [-1, 1].forEach((xs) => battens.push({ dims: [0.03, wallH - 0.06, 0.07], pos: [xs * 0.225, slabH + (wallH - 0.06) / 2, zs * (D / 2 - 0.035)], repeat: [1, 3] })),
  );
  [-1, 1].forEach((s) =>
    [-0.24, -0.08, 0.08, 0.24].forEach((bz) => battens.push({ dims: [0.015, wallH - 0.14, 0.022], pos: [s * 0.4625, slabH + 0.02 + (wallH - 0.14) / 2, bz], repeat: [1, 3] })),
  );
  [-1, 1].forEach((zs) =>
    [-1, 1].forEach((xs) =>
      battens.push({ dims: [0.022, wallH - 0.14, 0.015], pos: [xs * (doorW / 2 + sideW / 2), slabH + 0.02 + (wallH - 0.14) / 2, zs * (D / 2 - 0.0075)], repeat: [1, 3] }),
    ),
  );
  const battenMesh = mergedBoxes(t, battens, POST, { tex: 'wood', rough: 0.9 });
  battenMesh.userData.lodDetail = true;
  g.add(battenMesh);

  // ---- roof panels, symmetric both ways.
  const panels: MergedBoxSpec[] = [-1, 1].map((sx) => {
    const [cx, cy] = slopePt(sx, panelLen / 2);
    return { dims: [panelLen, roofT, roofD] as [number, number, number], pos: [cx, cy, 0] as [number, number, number], rotZ: -sx * PITCH, repeat: [2, 4] as [number, number] };
  });
  g.add(mergedBoxes(t, panels, ROOF, { tex: 'wood', rough: 0.9 }));

  // ---- shingle course lips: four battens per side lying across each panel,
  // so the roof carries real course lines instead of reading as one plank.
  const lips: MergedBoxSpec[] = [];
  [-1, 1].forEach((sx) => {
    const [nx, ny] = slopeN(sx);
    for (let i = 1; i <= 4; i += 1) {
      const [cx, cy] = slopePt(sx, (i * panelLen) / 5);
      lips.push({
        dims: [0.024, 0.016, roofD],
        pos: [cx + nx * (roofT / 2 + 0.007), cy + ny * (roofT / 2 + 0.007), 0],
        rotZ: -sx * PITCH,
        repeat: [1, 6],
      });
    }
  });
  const lipMesh = mergedBoxes(t, lips, ROOF, { tex: 'wood', rough: 0.9 });
  lipMesh.userData.lodDetail = true;
  g.add(lipMesh);

  // ---- roof trim: rake (barge) boards standing proud along BOTH gable edges,
  // eave fascias hiding the panel ends, one ridge cap. These are what make the
  // roof read as a roof from a three-quarter view — the old bare panels read
  // as two diagonal planks jutting out sideways.
  const roofTrim: MergedBoxSpec[] = [];
  [-1, 1].forEach((sx) => {
    const [nx, ny] = slopeN(sx);
    const [cx, cy] = slopePt(sx, panelLen / 2);
    [-1, 1].forEach((zs) =>
      roofTrim.push({
        dims: [panelLen + 0.006, 0.04, 0.028],
        pos: [cx + nx * 0.022, cy + ny * 0.022, zs * (roofD / 2 - 0.006)],
        rotZ: -sx * PITCH,
        repeat: [4, 1],
      }),
    );
    roofTrim.push({ dims: [0.034, 0.08, roofD + 0.014], pos: [sx * 0.6, eaveY - 0.0425, 0], repeat: [1, 4] });
  });
  // the cap is sized to swallow the four rake-board tips (they reach y 1.243):
  // at 36 mm proud with a slimmer cap they stood clear of it and read as four
  // little horns on the ridge ends from a high back angle
  roofTrim.push({ dims: [0.12, 0.06, roofD + 0.03], pos: [0, ridgeY + 0.012, 0], repeat: [1, 4] });
  g.add(mergedBoxes(t, roofTrim, TRIM, { tex: 'wood', rough: 0.9 }));

  // ---- solid gable infill at BOTH ends (no see-through attic). A PENTAGON,
  // not a triangle: its rake edges follow the roof underside exactly, so the
  // old 50 mm wedge of daylight at each gable corner is gone.
  // Its rake edges land exactly ON the roof underside; its BASE drops 20 mm
  // below the eave line instead, so it overlaps the plate ring rather than
  // sharing a coincident face with it (and the rake stays tight to the skin).
  const gs = new t.Shape();
  const gHalf = W / 2 - 0.01;
  gs.moveTo(-gHalf, -0.02);
  gs.lineTo(gHalf, -0.02);
  gs.lineTo(gHalf, underAt(gHalf) - eaveY);
  gs.lineTo(0, underAt(0) - eaveY);
  gs.lineTo(-gHalf, underAt(gHalf) - eaveY);
  gs.lineTo(-gHalf, -0.02);
  const gableGeo = new t.ExtrudeGeometry(gs, { depth: 0.06, bevelEnabled: false });
  g.add(
    mergedParts(
      t,
      [-1, 1].map((zs) => ({ geo: gableGeo, matrix: mtx(t, [0, eaveY, zs * (D / 2 - 0.045) - 0.03]), uv: [2, 1] as [number, number] })),
      mat(t, WALL, { tex: 'concrete', repeat: [2, 1], rough: 0.9 }),
    ),
  );

  // ---- THE MARQUEE. Shared frame, two dressings. The shelf is carried on the
  // head beam and the front capitals and braced by two knee braces; the sign
  // board stands ON the shelf, in FRONT of the front rake (rake boards reach
  // z 0.488, the board starts at 0.4955) so nothing has to be trimmed or
  // tucked. Board top: 1.141 entrance / 1.090 exit — both under the ridge.
  const shelfY = 0.845;
  const boardZ = isEnt ? 0.523 : 0.5205;
  const boardH = isEnt ? 0.245 : 0.2;
  const boardW = isEnt ? 0.9 : 0.86;
  const boardY = isEnt ? 0.985 : 0.958;
  const boardFront = boardZ + (isEnt ? 0.055 : 0.05) / 2;
  // the rail bites 4 mm DOWN over the board's top face — coincident faces
  // z-fight, and a cornice that merely rests on the board is exactly that
  const capY = boardY + boardH / 2 + (isEnt ? 0.018 : 0.016) - 0.004;

  const marquee: MergedBoxSpec[] = [
    // shelf: abuts the front wall face (0.39) and reaches z 0.55 under the board
    { dims: [0.9, 0.042, 0.175], pos: [0, shelfY, 0.4625], repeat: [4, 1] },
    // cornice rail over the board
    { dims: [isEnt ? 0.945 : 0.9, isEnt ? 0.036 : 0.032, isEnt ? 0.072 : 0.068], pos: [0, capY, boardZ + 0.0035], repeat: [4, 1] },
    // pilasters framing the board's ends
    ...[-1, 1].map((s) => ({
      dims: [isEnt ? 0.05 : 0.048, boardH + 0.02, (isEnt ? 0.055 : 0.05) + 0.007] as [number, number, number],
      pos: [s * (boardW / 2 - 0.0175), boardY, boardZ] as [number, number, number],
      repeat: [1, 2] as [number, number],
    })),
  ];
  // two knee braces from the wall face up to the shelf (endpoint-derived, so
  // both ends are buried in what they carry — nothing floats)
  [-1, 1].forEach((s) => {
    const y0 = 0.745;
    const z0 = 0.392;
    const y1 = 0.826;
    const z1 = 0.462;
    const len = Math.hypot(y1 - y0, z1 - z0) + 0.03;
    marquee.push({ dims: [0.04, len, 0.03], pos: [s * 0.305, (y0 + y1) / 2, (z0 + z1) / 2], rotX: Math.atan2(z1 - z0, y1 - y0) });
  });
  g.add(mergedBoxes(t, marquee, TRIM, { tex: 'wood', rough: 0.9 }));

  // ---- sign board (+ the entrance's stepped centre crest, which stops at
  // 1.209 — under the ridge cap, so the roof still wins the silhouette)
  const boards: MergedBoxSpec[] = [{ dims: [boardW, boardH, isEnt ? 0.055 : 0.05], pos: [0, boardY, boardZ], repeat: [4, 2] }];
  if (isEnt) boards.push({ dims: [0.32, 0.05, 0.052], pos: [0, 1.162, boardZ + 0.0025], repeat: [2, 1] });
  g.add(mergedBoxes(t, boards, WALL, { tex: 'wood', rough: 0.9 }));
  if (isEnt) g.add(box(t, [0.36, 0.024, 0.068], TRIM, [0, 1.197, boardZ + 0.0095], { tex: 'wood', repeat: [2, 1], rough: 0.9 }));

  // ---- scalloped valance under the shelf — the RCT2 fairground detail, and
  // what stops the marquee reading as a bare plank on brackets. Half-round
  // pendants, axis along z, hung 0.794 at their lowest: a 0.5-scale peep is
  // 0.561 tall on the slab (head at 0.641), so it walks well clear.
  const scallopGeo = new t.CylinderGeometry(0.028, 0.028, 0.06, 10);
  const scallops = mergedParts(
    t,
    Array.from({ length: 11 }, (_, i) => ({ geo: scallopGeo, matrix: mtx(t, [-0.4 + i * 0.08, 0.822, 0.518], [Math.PI / 2, 0, 0]) })),
    mat(t, BAND, { rough: 0.6 }),
  );
  scallops.userData.lodDetail = true;
  g.add(scallops);

  // ---- the band + its white frame stripes (the sign cabinet's bezel) and the
  // recessed LED screen, all sized to the BOARD now: the old 0.86 × 0.30 band
  // and 0.8-wide screen dominated the whole hut.
  const bandH = 0.185;
  const bandW = isEnt ? 0.82 : 0.78;
  const bandY = isEnt ? 0.965 : 0.956;
  const bandT = isEnt ? 0.035 : 0.032;
  const bandZ = boardFront + bandT / 2 - 0.008; // seated 8 mm into the board
  g.add(box(t, [bandW, bandH, bandT], BAND, [0, bandY, bandZ], { rough: 0.55 }));
  const stripeT = bandT + 0.005;
  g.add(
    mergedBoxes(
      t,
      [1, -1].map((s) => ({ dims: [bandW + 0.025, 0.026, stripeT] as [number, number, number], pos: [0, bandY + s * (bandH / 2 - 0.013), bandZ + 0.003] as [number, number, number] })),
      PALE,
      { rough: 0.55 },
    ),
  );
  // flush with the band face, 1.5 mm under the frame stripes' proud lip
  mountLedScreen(t, g, isEnt ? 'ENTRANCE' : 'EXIT', isEnt ? 0x39ff6a : 0xff3b30, [0, bandY, bandZ + bandT / 2 + 0.0015], isEnt ? 0.7 : 0.39);

  if (isEnt) {
    // ---- ENTRANCE: a row of nine marquee bulbs on the board above the band,
    // under the cornice rail. ONE merged mesh, ONE material — night-gated via
    // onBeforeRender + nightKOf (the { group, doorway } contract carries no
    // update fn) and driving the single warm sign light.
    const bulbMat = new t.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc76a, emissiveIntensity: 0.25, roughness: 0.4 });
    const bulbGeo = new t.SphereGeometry(0.018, 8, 6);
    const bulbs = mergedParts(
      t,
      Array.from({ length: 9 }, (_, i) => ({ geo: bulbGeo, matrix: mtx(t, [-0.4 + i * 0.1, 1.085, boardFront + 0.004]) })),
      bulbMat,
    );
    g.add(bulbs);
    const signLight = new t.PointLight(0xffd98c, 0, 2.8, 2);
    signLight.position.set(0, 1.05, 0.85);
    g.add(signLight);
    bulbs.onBeforeRender = () => {
      const k = nightKOf(bulbs);
      const ease = k * k * (3 - 2 * k); // smoothstep
      bulbMat.emissiveIntensity = 0.25 + 2.1 * ease;
      signLight.intensity = ease * 0.85;
    };
  } else {
    // ---- EXIT: one small bracket lamp over the cornice rail — the plain
    // sibling's single night feature, and it stays under the ridge cap.
    g.add(cyl(t, 0.011, 0.011, 0.08, TRIM, [0, 1.098, boardZ + 0.008], { rough: 0.7, seg: 8 }));
    g.add(cyl(t, 0.02, 0.055, 0.045, TRIM, [0, 1.152, boardZ + 0.008], { rough: 0.7, seg: 10 }));
    const lamp = ball(t, 0.026, 0xffe9a8, [0, 1.132, boardZ + 0.008], { emissive: 0xffc76a, rough: 0.4 });
    const lampMat = lamp.material as THREE.MeshStandardMaterial;
    lampMat.emissiveIntensity = 0.25;
    g.add(lamp);
    const doorLight = new t.PointLight(0xffd98c, 0, 2.6, 2);
    doorLight.position.set(0, 1.0, 0.82);
    g.add(doorLight);
    lamp.onBeforeRender = () => {
      const k = nightKOf(lamp);
      const ease = k * k * (3 - 2 * k); // smoothstep
      lampMat.emissiveIntensity = 0.25 + 2.1 * ease;
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
        // SIDE BY SIDE in x, both facing +z, both the SAME distance from the
        // camera. The old layout spread them along the 45° camera's screen-x
        // diagonal, which put one hut 2.6 u nearer than the other: the near one
        // was seen from almost straight above (its marquee vanished under its
        // own roof overhang) and the far one from a shallow angle — they could
        // not be compared, which is the whole point of this preview.
        const ent = buildRideEntrance(t, { kind: 'entrance' });
        ent.group.position.set(-0.72, 0, 0);
        g.add(ent.group);
        const ex = buildRideEntrance(t, { kind: 'exit' });
        ex.group.position.set(0.72, 0, 0);
        g.add(ex.group);

        const p = buildPeep(t, { expression: 'happy' });
        p.group.scale.setScalar(0.5);
        g.add(p.group);

        return (time) => {
          const span = 3.4;
          const u = (time * 0.3) % 1;
          const z = 1.7 - u * span; // front → through the entrance doorway → out the back
          p.walk(time * 1.5, 0); // walk() sets the bob y — lift onto the slab after
          p.group.position.set(-0.72, 0.08 + p.group.position.y, z);
          p.group.rotation.y = Math.PI; // facing −z, into the hut
        };
      })(three, group) || undefined;
  return { group, update };
}

/** <RideEntrance> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const RideEntrance = composable('RideEntrance', (t) => buildRideEntranceScene(t));

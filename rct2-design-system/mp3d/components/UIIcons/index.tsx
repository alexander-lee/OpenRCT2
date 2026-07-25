import React from 'react';

// ---------------------------------------------------------------------------
// UIIcons — the pixel-art icon set for ALL overlay UI (rules/ui.md). Every
// icon is an original hand-drawn pixel grid (10x10 pictograms, 12x12 for the
// finer sun/wrench, 14x14 for the guest emotion faces) in the RCT2 toolbar-
// pictogram spirit: a few flat colours plus a dark outline, rendered as SVG
// <rect> cells with crispEdges (no emoji, no icon libraries, no smooth
// vector art). Icons scale in integer-ish steps and stay chunky.
//
//   <UIIcon name="sun" size={20} />
//
// Grid legend: '.' = transparent; any other char looks up the icon's palette.
// ---------------------------------------------------------------------------

const OUTLINE = '#3A3226'; // shared dark outline (window chrome outline tone)

interface IconDef {
  grid: string[]; // square pixel raster (10, 12 or 14 per side)
  colors: Record<string, string>;
}

// Each grid below is drawn by hand on a square raster. Keep every row exactly
// as wide as the grid is tall — the renderer trusts the grid.
const ICONS = {
  // 8-ray sun: round gold disc, amber lower shading, dark ring (12x12)
  sun: {
    grid: [
      '.....yy.....',
      '.y...yy...y.',
      '..y.kkkk.y..',
      '...kyyyyk...',
      '..kyyyyyyk..',
      'yykyyyyyykyy',
      'yykyaaaaykyy',
      '..kaaaaaak..',
      '...kaaaak...',
      '..y.kkkk.y..',
      '.y...yy...y.',
      '.....yy.....',
    ],
    colors: { y: '#F0B818', a: '#C87810', k: '#4A3210' },
  },
  // crescent moon: pale cream, pointed tips right, shaded inner edge
  moon: {
    grid: [
      '....kkk...',
      '..kkccdk..',
      '.kcccdk...',
      '.kccdk....',
      'kcccdk....',
      'kcccdk....',
      '.kccdk....',
      '.kcccdk...',
      '..kkccdk..',
      '....kkk...',
    ],
    colors: { c: '#F0E8D0', d: '#C0B088', k: OUTLINE },
  },
  // coaster hill: red track arc on grey support legs over the ground line
  ride: {
    grid: [
      '....kk....',
      '..kkrrkk..',
      '.krrrrrrk.',
      '.krr..rrk.',
      'krr....rrk',
      'krr....rrk',
      '.ss....ss.',
      '.ss....ss.',
      'kkkkkkkkkk',
      '..........',
    ],
    colors: { r: '#C03018', s: '#8A8578', k: OUTLINE },
  },
  // guest head: hair, skin, dot eyes, small mouth
  guest: {
    grid: [
      '...kkkk...',
      '..khhhhk..',
      '.khhhhhhk.',
      '.khffffhk.',
      '.kfkffkfk.',
      '.kffffffk.',
      '.kffkkffk.',
      '..kffffk..',
      '...kkkk...',
      '..........',
    ],
    colors: { h: '#6B3A1A', f: '#E8A878', k: OUTLINE },
  },
  // park tree: two-green canopy, brown trunk, grass base
  park: {
    grid: [
      '...kkkk...',
      '..klgggk..',
      '.kllggggk.',
      '.klgggggk.',
      '.kggggggk.',
      '..kggggk..',
      '...kttk...',
      '...kttk...',
      'ggkkttkkgg',
      '..........',
    ],
    colors: { g: '#3E7028', l: '#6EA83E', t: '#6B4620', k: OUTLINE },
  },
  // camera: grey body, viewfinder bump, cream lens, red record pip
  camera: {
    grid: [
      '..........',
      '...kkk....',
      'kkkkkkkkkk',
      'kbbkkkkbrk',
      'kbbkcckbbk',
      'kbbkcckbbk',
      'kbbkkkkbbk',
      'kkkkkkkkkk',
      '..........',
      '..........',
    ],
    colors: { b: '#8A8578', c: '#E8E0C8', r: '#C03018', k: OUTLINE },
  },
  // wrench: two-prong open-end head top-left, steel shaft to bottom-right (12x12)
  wrench: {
    grid: [
      '.kkk..kkk...',
      '.kssk.kssk..',
      '.kssk.kssk..',
      '.ksskkkssk..',
      '..kssssssk..',
      '...kssssk...',
      '....kssdk...',
      '.....kssdk..',
      '......kssdk.',
      '.......kssdk',
      '........kssk',
      '.........kk.',
    ],
    colors: { s: '#A8A8B0', d: '#70707A', k: OUTLINE },
  },
  // warning: gold triangle, dark exclamation
  warning: {
    grid: [
      '....kk....',
      '...kyyk...',
      '...kyyk...',
      '..kykkyk..',
      '..kykkyk..',
      '.kyykkyyk.',
      '.kyy..yyk.',
      'kyyykkyyyk',
      'kkkkkkkkkk',
      '..........',
    ],
    colors: { y: '#E8B818', k: '#3A2C10' },
  },
  // close X: two 2px diagonals, dark red core like the title bar
  close: {
    grid: [
      '..........',
      'kk......kk',
      '.kk....kk.',
      '..kk..kk..',
      '...kkkk...',
      '....kk....',
      '...kkkk...',
      '..kk..kk..',
      '.kk....kk.',
      'kk......kk',
    ],
    colors: { k: OUTLINE },
  },
  chevronUp: {
    grid: [
      '..........',
      '..........',
      '....kk....',
      '...kkkk...',
      '..kk..kk..',
      '.kk....kk.',
      'kk......kk',
      '..........',
      '..........',
      '..........',
    ],
    colors: { k: OUTLINE },
  },
  chevronDown: {
    grid: [
      '..........',
      '..........',
      '..........',
      'kk......kk',
      '.kk....kk.',
      '..kk..kk..',
      '...kkkk...',
      '....kk....',
      '..........',
      '..........',
    ],
    colors: { k: OUTLINE },
  },
  // happy guest face: gold, dot eyes, up-curved smile
  happy: {
    grid: [
      '...kkkk...',
      '..kyyyyk..',
      '.kyyyyyyk.',
      'kyykyykyyk',
      'kyyyyyyyyk',
      'kykyyyykyk',
      '.kykkkkyk.',
      '.kyyyyyyk.',
      '..kyyyyk..',
      '...kkkk...',
    ],
    colors: { y: '#E8C020', k: '#3A2C10' },
  },
  // sad guest face: sunburnt orange, down-curved frown
  sad: {
    grid: [
      '...kkkk...',
      '..kyyyyk..',
      '.kyyyyyyk.',
      'kyykyykyyk',
      'kyyyyyyyyk',
      'kyyykkyyyk',
      '.kykyykyk.',
      '.kyyyyyyk.',
      '..kyyyyk..',
      '...kkkk...',
    ],
    colors: { y: '#E07828', k: '#3A1C08' },
  },

  // ---- guest EMOTION faces (14x14) — original pixel art in the spirit of
  // RCT2's guest-face UI range (ecstatic → happy → neutral → unhappy → angry,
  // plus the green sick face): round skin-tone discs with expressive pixel
  // brows, eyes and mouths. Drawn by hand on a 14x14 raster; no game sprites.
  // faceEcstatic: raised brows, blushing cheeks, huge open grin
  faceEcstatic: {
    grid: [
      '....kkkkkk....',
      '..kkffffffkk..',
      '.kfbbffffbbfk.',
      '.kffffffffffk.',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kfrffffffffrfk',
      'kffmffffffmffk',
      'kffmoooooomffk',
      'kfffmoooomfffk',
      '.kffmmmmmmffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#EFB98C', k: '#3A2416', b: '#5A3418', e: '#1E1410', r: '#E2795B', m: '#55240E', o: '#7E2B1E' },
  },
  // faceHappy: relaxed eyes, light blush, up-curved closed smile
  faceHappy: {
    grid: [
      '....kkkkkk....',
      '..kkffffffkk..',
      '.kffffffffffk.',
      '.kffffffffffk.',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kffffffffffffk',
      'kfrffffffffrfk',
      'kffmffffffmffk',
      'kfffmmmmmmfffk',
      '.kffffffffffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#EFB98C', k: '#3A2416', e: '#1E1410', r: '#E2795B', m: '#55240E' },
  },
  // faceNeutral: flat brows, level gaze, dead-straight mouth
  faceNeutral: {
    grid: [
      '....kkkkkk....',
      '..kkffffffkk..',
      '.kfbbffffbbfk.',
      '.kffffffffffk.',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kffffffffffffk',
      'kffffffffffffk',
      'kffffffffffffk',
      'kfffmmmmmmfffk',
      '.kffffffffffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#EFB98C', k: '#3A2416', b: '#5A3418', e: '#1E1410', m: '#55240E' },
  },
  // faceUnhappy: worried brows (inner ends up), droopy eyes, down-curved frown
  faceUnhappy: {
    grid: [
      '....kkkkkk....',
      '..kkffffffkk..',
      '.kfffbffbfffk.',
      '.kfbbffffbbfk.',
      'kffffffffffffk',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kffffffffffffk',
      'kffffmmmmffffk',
      'kfffmffffmfffk',
      '.kffffffffffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#EFB98C', k: '#3A2416', b: '#5A3418', e: '#1E1410', m: '#55240E' },
  },
  // faceAngry: flushed red skin, V-brows knotted inward, gritted teeth
  faceAngry: {
    grid: [
      '....kkkkkk....',
      '..kkffffffkk..',
      '.kffffffffffk.',
      '.kfbffffffbfk.',
      'kffffbffbffffk',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kffffffffffffk',
      'kffmmmmmmmmffk',
      'kffmwmwmwmwffk',
      '.kffffffffffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#E4573B', k: '#38130A', b: '#2A0E06', e: '#1A0A05', m: '#3C1208', w: '#F5EFE2' },
  },
  // faceSick: queasy green skin, heavy eyelids, sweat bead, wavy grimace
  faceSick: {
    grid: [
      '....kkkkkk....',
      '..kkfffffwkk..',
      '.kffffffffffk.',
      '.kfbbffffbbfk.',
      'kfffeffffefffk',
      'kfffeffffefffk',
      'kfgffffffffgfk',
      'kffffffffffffk',
      'kffffmfmfmfffk',
      'kfffmfmfmfmffk',
      '.kffffffffffk.',
      '.kffffffffffk.',
      '..kkffffffkk..',
      '....kkkkkk....',
    ],
    colors: { f: '#8FBC66', k: '#2E3D1C', b: '#4A6428', e: '#182212', g: '#6E9A4C', m: '#26330F', w: '#D8ECF2' },
  },
} satisfies Record<string, IconDef>;

export type UIIconName = keyof typeof ICONS;

export const UI_ICON_NAMES = Object.keys(ICONS) as UIIconName[];

export interface UIIconProps {
  name: UIIconName;
  /** rendered size in px (square, default 20) */
  size?: number;
}

/** One pixel-art icon: a 10x10 grid of <rect> cells, crisp-edged. */
export function UIIcon({ name, size = 20 }: UIIconProps) {
  const def = ICONS[name];
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < rows; y++) {
    const row = def.grid[y];
    // merge horizontal runs of the same colour into single rects
    let x = 0;
    while (x < cols) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let x2 = x + 1;
      while (x2 < cols && row[x2] === ch) x2++;
      cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={x2 - x} height={1} fill={def.colors[ch] ?? OUTLINE} />);
      x = x2;
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      {cells}
    </svg>
  );
}

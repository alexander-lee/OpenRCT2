import React from 'react';

/** All RCT2 sprites are packed into ONE hosted atlas image; components slice it. */
export const ATLAS_URL = "__ATLAS_URL__";
export const ATLAS_W = 1200;
export const ATLAS_H = 1375;

/** [sx, sy, w, h] — a rectangle within the atlas (unscaled px). */
export type Cell = [number, number, number, number];

/** Renders a single atlas cell at an integer pixel scale (nearest-neighbour). */
export function AtlasCell({ cell, scale = 4 }: { cell: Cell; scale?: number }) {
  const [sx, sy, w, h] = cell;
  return (
    <div style={{ width: w * scale, height: h * scale, overflow: 'hidden', position: 'relative' }}>
      <img src={ATLAS_URL} alt="" draggable={false}
        style={{ position: 'absolute', left: -sx * scale, top: -sy * scale,
                 width: ATLAS_W * scale, height: ATLAS_H * scale, maxWidth: 'none' }} />
    </div>
  );
}

import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[180,1077,23,35],[204,1077,23,35],[228,1077,23,35],[252,1077,23,35]];

export function ConiferShrub() {
  return <SpriteRotator name="Conifer Shrub" group="Scenery \u00b7 Nature" cells={CELLS} />;
}

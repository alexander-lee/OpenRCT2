import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[276,1077,64,35],[341,1077,64,35],[406,1077,64,35],[471,1077,64,35]];

export function TieredFountain() {
  return <SpriteRotator name="Tiered Fountain" group="Scenery \u00b7 Water Feature" cells={CELLS} />;
}

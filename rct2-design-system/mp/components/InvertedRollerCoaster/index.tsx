import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[186,1146,32,30],[219,1146,32,30],[252,1146,32,30],[285,1146,32,30]];

export function InvertedRollerCoaster() {
  return <SpriteRotator name="Inverted Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

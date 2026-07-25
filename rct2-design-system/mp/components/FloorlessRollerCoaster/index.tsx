import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[78,1146,26,30],[105,1146,26,30],[132,1146,26,30],[159,1146,26,30]];

export function FloorlessRollerCoaster() {
  return <SpriteRotator name="Floorless Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[404,1264,24,23],[429,1264,24,23],[454,1264,24,23],[479,1264,24,23]];

export function WoodenWildMouse() {
  return <SpriteRotator name="Wooden Wild Mouse" group="Roller Coaster" cells={CELLS} />;
}

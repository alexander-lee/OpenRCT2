import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1104,1077,46,32],[1151,1077,46,32],[0,1113,46,32],[47,1113,46,32]];

export function SpiralRollerCoaster() {
  return <SpriteRotator name="Spiral Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

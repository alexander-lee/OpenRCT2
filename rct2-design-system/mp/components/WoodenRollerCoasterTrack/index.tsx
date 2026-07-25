import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[241,991,68,43],[310,991,68,43],[379,991,68,43],[448,991,68,43]];

export function WoodenRollerCoasterTrack() {
  return <SpriteRotator name="Wooden Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}

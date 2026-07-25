import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1102,1113,38,30],[1141,1113,38,30],[0,1146,38,30],[39,1146,38,30]];

export function WoodenRollerCoasterTrains() {
  return <SpriteRotator name="Wooden Roller Coaster Trains" group="Roller Coaster" cells={CELLS} />;
}

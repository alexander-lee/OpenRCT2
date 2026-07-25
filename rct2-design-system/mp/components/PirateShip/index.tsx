import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[966,200,111,123],[1078,200,111,123],[0,378,111,123],[112,378,111,123]];

export function PirateShip() {
  return <SpriteRotator name="Pirate Ship" group="Thrill Ride" cells={CELLS} />;
}

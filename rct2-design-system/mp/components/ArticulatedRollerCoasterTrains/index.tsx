import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1127,1177,34,28],[1162,1177,34,28],[0,1208,34,28],[35,1208,34,28]];

export function ArticulatedRollerCoasterTrains() {
  return <SpriteRotator name="Articulated Roller Coaster Trains" group="Roller Coaster" cells={CELLS} />;
}

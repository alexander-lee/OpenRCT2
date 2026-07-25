import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[536,1077,38,34],[575,1077,38,34],[614,1077,38,34],[653,1077,38,34]];

export function RiverRapids() {
  return <SpriteRotator name="River Rapids" group="Water Ride" cells={CELLS} />;
}

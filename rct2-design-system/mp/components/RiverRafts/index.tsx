import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[777,991,44,42],[822,991,44,42],[867,991,44,42],[912,991,44,42]];

export function RiverRafts() {
  return <SpriteRotator name="River Rafts" group="Water Ride" cells={CELLS} />;
}

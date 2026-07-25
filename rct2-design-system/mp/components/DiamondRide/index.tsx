import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[224,378,137,113],[362,378,137,113],[500,378,137,113],[638,378,137,113]];

export function DiamondRide() {
  return <SpriteRotator name="Diamond Ride" group="Thrill Ride" cells={CELLS} />;
}

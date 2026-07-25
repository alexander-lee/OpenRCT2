import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[391,610,149,98],[541,610,149,98],[691,610,149,98],[841,610,149,98]];

export function FireCrackerRide() {
  return <SpriteRotator name="Fire Cracker Ride" group="Thrill Ride" cells={CELLS} />;
}

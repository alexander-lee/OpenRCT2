import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[41,991,49,43],[91,991,49,43],[141,991,49,43],[191,991,49,43]];

export function DhowWaterRide() {
  return <SpriteRotator name="Dhow water ride" group="Water Ride" cells={CELLS} />;
}

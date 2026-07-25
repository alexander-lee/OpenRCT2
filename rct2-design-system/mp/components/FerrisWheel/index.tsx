import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[752,0,141,177],[894,0,141,177],[1036,0,141,177],[0,200,141,177]];

export function FerrisWheel() {
  return <SpriteRotator name="Ferris Wheel" group="Gentle Ride" cells={CELLS} />;
}

import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[720,1038,56,35],[777,1038,56,35],[834,1038,56,35],[891,1038,56,35]];

export function SplashBoats() {
  return <SpriteRotator name="Splash Boats" group="Water Ride" cells={CELLS} />;
}

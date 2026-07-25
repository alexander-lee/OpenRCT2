import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[942,1208,36,26],[979,1208,36,26],[1016,1208,36,26],[1053,1208,36,26]];

export function WoodenSideFrictionCars() {
  return <SpriteRotator name="Wooden Side-Friction Cars" group="Roller Coaster" cells={CELLS} />;
}

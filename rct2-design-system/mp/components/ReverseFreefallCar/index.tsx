import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[957,991,60,40],[1018,991,60,40],[1079,991,60,40],[1140,991,60,40]];

export function ReverseFreefallCar() {
  return <SpriteRotator name="Reverse Freefall Car" group="Roller Coaster" cells={CELLS} />;
}

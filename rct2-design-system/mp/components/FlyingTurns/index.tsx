import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[372,1038,44,36],[417,1038,44,36],[462,1038,44,36],[507,1038,44,36]];

export function FlyingTurns() {
  return <SpriteRotator name="Flying Turns" group="Roller Coaster" cells={CELLS} />;
}

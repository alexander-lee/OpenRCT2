import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[790,1113,32,31],[823,1113,32,31],[856,1113,32,31],[889,1113,32,31]];

export function TwisterRollerCoaster() {
  return <SpriteRotator name="Twister Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

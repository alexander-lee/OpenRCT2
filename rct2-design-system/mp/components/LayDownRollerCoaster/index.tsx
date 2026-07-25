import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[802,1208,34,27],[837,1208,34,27],[872,1208,34,27],[907,1208,34,27]];

export function LayDownRollerCoaster() {
  return <SpriteRotator name="Lay-down Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

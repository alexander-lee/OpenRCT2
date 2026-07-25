import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[646,1208,38,27],[685,1208,38,27],[724,1208,38,27],[763,1208,38,27]];

export function MouseCars() {
  return <SpriteRotator name="Mouse Cars" group="Roller Coaster" cells={CELLS} />;
}

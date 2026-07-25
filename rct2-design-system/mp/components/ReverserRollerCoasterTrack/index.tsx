import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[462,1208,45,28],[508,1208,45,28],[554,1208,45,28],[600,1208,45,28]];

export function ReverserRollerCoasterTrack() {
  return <SpriteRotator name="Reverser Roller Coaster Track" group="Track Rail" cells={CELLS} />;
}

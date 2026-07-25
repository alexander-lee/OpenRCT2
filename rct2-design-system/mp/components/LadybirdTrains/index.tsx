import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[231,1237,28,25],[260,1237,28,25],[289,1237,28,25],[318,1237,28,25]];

export function LadybirdTrains() {
  return <SpriteRotator name="Ladybird Trains" group="Roller Coaster" cells={CELLS} />;
}

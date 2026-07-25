import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[924,1077,44,33],[969,1077,44,33],[1014,1077,44,33],[1059,1077,44,33]];

export function Hypercoaster() {
  return <SpriteRotator name="Hypercoaster" group="Roller Coaster" cells={CELLS} />;
}

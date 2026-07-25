import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1053,884,58,50],[1112,884,58,50],[0,940,58,50],[59,940,58,50]];

export function BarnstormingCoaster() {
  return <SpriteRotator name="BarnStorming Coaster" group="Roller Coaster" cells={CELLS} />;
}

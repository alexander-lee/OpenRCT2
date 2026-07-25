import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[139,610,62,101],[202,610,62,101],[265,610,62,101],[328,610,62,101]];

export function LargeTree() {
  return <SpriteRotator name="Large Tree" group="Scenery \u00b7 Nature" cells={CELLS} />;
}

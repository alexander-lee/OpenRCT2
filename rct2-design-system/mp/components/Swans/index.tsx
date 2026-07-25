import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[552,1038,41,36],[594,1038,41,36],[636,1038,41,36],[678,1038,41,36]];

export function Swans() {
  return <SpriteRotator name="Swans" group="Water Ride" cells={CELLS} />;
}

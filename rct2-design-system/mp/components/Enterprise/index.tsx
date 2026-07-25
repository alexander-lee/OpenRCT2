import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[486,715,141,89],[628,715,141,89],[770,715,141,89],[912,715,141,89]];

export function Enterprise() {
  return <SpriteRotator name="Enterprise" group="Thrill Ride" cells={CELLS} />;
}

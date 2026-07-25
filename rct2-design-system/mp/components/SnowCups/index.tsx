import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[776,378,131,107],[908,378,131,107],[1040,378,131,107],[0,502,131,107]];

export function SnowCups() {
  return <SpriteRotator name="Snow Cups" group="Thrill Ride" cells={CELLS} />;
}

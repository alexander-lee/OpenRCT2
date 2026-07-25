import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[602,940,60,47],[663,940,60,47],[724,940,60,47],[785,940,60,47]];

export function KoalaRide() {
  return <SpriteRotator name="Koala Ride" group="Roller Coaster" cells={CELLS} />;
}

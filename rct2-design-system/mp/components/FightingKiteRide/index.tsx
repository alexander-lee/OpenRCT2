import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[648,502,138,104],[787,502,138,104],[926,502,138,104],[0,610,138,104]];

export function FightingKiteRide() {
  return <SpriteRotator name="Fighting Kite Ride" group="Thrill Ride" cells={CELLS} />;
}

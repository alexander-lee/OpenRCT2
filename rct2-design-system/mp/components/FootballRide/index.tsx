import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[493,884,88,52],[582,884,88,52],[671,884,88,52],[760,884,88,52]];

export function FootballRide() {
  return <SpriteRotator name="Football Ride" group="Roller Coaster" cells={CELLS} />;
}

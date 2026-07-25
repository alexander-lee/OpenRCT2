import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[583,1177,24,29],[608,1177,24,29],[633,1177,24,29],[658,1177,24,29]];

export function MotorbikeRaces() {
  return <SpriteRotator name="Motorbike Races" group="Roller Coaster" cells={CELLS} />;
}

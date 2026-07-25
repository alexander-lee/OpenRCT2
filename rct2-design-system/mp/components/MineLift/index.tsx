import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[38,813,60,66],[99,813,60,66],[160,813,60,66],[221,813,60,66]];

export function MineLift() {
  return <SpriteRotator name="Mine Lift" group="Transport Ride" cells={CELLS} />;
}

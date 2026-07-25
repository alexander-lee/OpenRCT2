import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[282,813,58,61],[341,813,58,61],[400,813,58,61],[459,813,58,61]];

export function Elevator() {
  return <SpriteRotator name="Elevator" group="Transport Ride" cells={CELLS} />;
}

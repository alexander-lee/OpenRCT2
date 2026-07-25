import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[682,813,62,58],[745,813,62,58],[808,813,62,58],[871,813,62,58]];

export function Teleporter() {
  return <SpriteRotator name="Teleporter" group="Transport Ride" cells={CELLS} />;
}

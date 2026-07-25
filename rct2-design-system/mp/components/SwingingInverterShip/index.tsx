import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[142,200,90,158],[233,200,90,158],[324,200,90,158],[415,200,90,158]];

export function SwingingInverterShip() {
  return <SpriteRotator name="Swinging Inverter Ship" group="Thrill Ride" cells={CELLS} />;
}

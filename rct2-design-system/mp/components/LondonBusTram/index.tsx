import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[273,884,54,54],[328,884,54,54],[383,884,54,54],[438,884,54,54]];

export function LondonBusTram() {
  return <SpriteRotator name="London Bus Tram" group="Transport Ride" cells={CELLS} />;
}

import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[988,1264,38,22],[1027,1264,38,22],[1066,1264,38,22],[1105,1264,38,22]];

export function LogFlume() {
  return <SpriteRotator name="Log Flume" group="Water Ride" cells={CELLS} />;
}

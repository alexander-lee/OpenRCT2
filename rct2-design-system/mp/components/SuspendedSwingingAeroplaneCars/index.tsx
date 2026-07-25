import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[849,884,50,51],[900,884,50,51],[951,884,50,51],[1002,884,50,51]];

export function SuspendedSwingingAeroplaneCars() {
  return <SpriteRotator name="Suspended Swinging Aeroplane Cars" group="Roller Coaster" cells={CELLS} />;
}

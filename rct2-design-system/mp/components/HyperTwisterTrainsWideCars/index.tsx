import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[94,1113,34,32],[129,1113,34,32],[164,1113,34,32],[199,1113,34,32]];

export function HyperTwisterTrainsWideCars() {
  return <SpriteRotator name="Hyper-Twister Trains (wide cars)" group="Roller Coaster" cells={CELLS} />;
}

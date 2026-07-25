import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[347,1237,26,25],[374,1237,26,25],[401,1237,26,25],[428,1237,26,25]];

export function GhostTrain() {
  return <SpriteRotator name="Ghost Train" group="Gentle Ride" cells={CELLS} />;
}

import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[73,884,49,55],[123,884,49,55],[173,884,49,55],[223,884,49,55]];

export function GiantSkull() {
  return <SpriteRotator name="Giant Skull" group="Scenery \u00b7 Statue" cells={CELLS} />;
}

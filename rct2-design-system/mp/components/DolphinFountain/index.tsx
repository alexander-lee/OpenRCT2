import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[118,940,45,49],[164,940,45,49],[210,940,45,49],[256,940,45,49]];

export function DolphinFountain() {
  return <SpriteRotator name="Dolphin Fountain" group="Scenery \u00b7 Water Feature" cells={CELLS} />;
}

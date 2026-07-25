import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[1050,940,40,46],[1091,940,40,46],[1132,940,40,46],[0,991,40,46]];

export function ParkBench() {
  return <SpriteRotator name="Park Bench" group="Scenery \u00b7 Urban" cells={CELLS} />;
}

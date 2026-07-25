import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[302,940,74,47],[377,940,74,47],[452,940,74,47],[527,940,74,47]];

export function JetPackBooster() {
  return <SpriteRotator name="Jet Pack Booster" group="Roller Coaster" cells={CELLS} />;
}

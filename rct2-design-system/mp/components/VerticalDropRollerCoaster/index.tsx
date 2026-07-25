import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[634,1113,38,31],[673,1113,38,31],[712,1113,38,31],[751,1113,38,31]];

export function VerticalDropRollerCoaster() {
  return <SpriteRotator name="Vertical Drop Roller Coaster" group="Roller Coaster" cells={CELLS} />;
}

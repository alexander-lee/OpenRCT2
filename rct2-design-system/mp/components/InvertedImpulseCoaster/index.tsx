import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[232,1038,34,37],[267,1038,34,37],[302,1038,34,37],[337,1038,34,37]];

export function InvertedImpulseCoaster() {
  return <SpriteRotator name="Inverted Impulse Coaster" group="Roller Coaster" cells={CELLS} />;
}

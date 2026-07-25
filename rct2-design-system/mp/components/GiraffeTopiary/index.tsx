import React from 'react';
import { SpriteRotator } from '../SpriteRotator';
import type { Cell } from '../Atlas';

const CELLS: Cell[] = [[342,715,35,91],[378,715,35,91],[414,715,35,91],[450,715,35,91]];

export function GiraffeTopiary() {
  return <SpriteRotator name="Giraffe Topiary" group="Scenery \u00b7 Statue" cells={CELLS} />;
}

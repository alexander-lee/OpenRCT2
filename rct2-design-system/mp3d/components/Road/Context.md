# Road

**CANONICAL IMPORT — copy exactly:** `import { Road } from './components/Road';`
*(never from `'./Park'`: only the `<Park>` wrappers + track-piece JSX live there. A wrong
specifier makes esbuild refuse the WHOLE bundle — the round-8 black-page failure.)*

A paved road tile with kerbs and centre line, modelled from the RCT2 tarmac footpath. Drag to orbit.

Built with three.js on top of the shared `Stage` component. The geometry is hand-modelled to match the colours and proportions of the authentic RollerCoaster Tycoon 2 sprite (its 4 rotations were used as reference).

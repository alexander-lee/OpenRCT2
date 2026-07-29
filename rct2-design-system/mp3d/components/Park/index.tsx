// ---------------------------------------------------------------------------
// Park — the REACT COMPOSITION API. Compose an entire park as JSX on ONE
// shared canvas: `<Park>` renders a single full-screen Stage, creates the one
// GameManager, mounts the UI-window suite (ParkInfo + click-to-open
// RideViewer/GuestInfo) and runs `validatePark` once the children settle.
// Children are thin declarative wrappers over the existing imperative
// builders (rules/park-generation.md is still the recipe book — the wrappers
// apply exactly those recipes): they build in a `useEffect`, place from
// props, register with the manager and clean up on unmount.
//
// This is a HAND-ROLLED context (NOT react-three-fiber): the ParkContext
// carries the THREE namespace, the root group, the StageApi and a mutable
// store that <Terrain>/<Paths> fill in. Because sibling effects run in JSX
// order, COMPOSITION ORDER IS MOUNT ORDER — declare
//   <Terrain> → <Paths> → <Gate> → rides/stalls/amenities → scenery
// exactly like the imperative build order (§2 of the recipe book).
//
// Determinism: every wrapper is deterministic (hashed-sine only). Prop
// changes REMOUNT the object (rebuild + reregister visuals); note that
// GameManager registrations (rides/stalls/gate) cannot be unregistered — to
// change a ride's sim config, remount the whole <Park> (give it a `key`).
// ---------------------------------------------------------------------------

// V3 and XZ are re-exported deliberately: the rules and two skills all print
// `import type { V3, XZ } from './components/Park'` as the canonical line, and
// without these names that documented import is a TS2305 every park inherits.
export type { ParkPosition, V3, XZ, AddObjectOpts, ParkGround, ParkPathsInfo, ParkTerrainApi, ParkContextValue } from './parkContext';
export { usePark } from './parkContext';

// round-7 PLACEMENT SUGGESTION API (rules/park-generation.md §0.14): ask the
// lattice where a pad/prop may stand instead of guessing a cell centre and
// discovering the answer as a `blockers`/`scenery` FAIL.
export { offPathCell, pathClearance } from '../ParkBuilder';
export type { StreetLattice, PathClearance, OffPathCellOpts } from '../ParkBuilder';

export type { ComposableBuilt, ComposableProps, ComposableConfig, ScenePreviewProps } from './composable';
export { useComposable, composable, ScenePreview, tagComponent } from './composable';

export type {
  RideRegisterProps,
  RideLayout,
  ComposableRideBuilt,
  ComposableRideProps,
  ConfigurableRideProps,
  ComposableStallProps,
  ConfigurableStallProps,
} from './configurableRide';
export { registerComposedRide, ConfigurableRide, composableRide, ConfigurableStall, composableStall } from './configurableRide';

export type { TrackPieceProps, CoasterProps, TrackRideProps } from './pieces';
export {
  Station,
  Straight,
  Lift,
  Drop,
  Hill,
  TurnL,
  TurnR,
  HelixL,
  HelixR,
  SBend,
  Corkscrew,
  Loop,
  collectTrackPieces,
  Coaster,
  TrackRide,
} from './pieces';

export type {
  TerrainProps,
  PathsProps,
  GateProps,
  FlatRideBuilt,
  FlatRideProps,
  PlacedProps,
  StallProps,
  RestroomProps,
  FountainProps,
  TorchProps,
  NeonProps,
  DanceFloorRProps,
  SceneryProps,
  LightsProps,
} from './wrappers';
export {
  Terrain,
  Paths,
  Gate,
  FlatRide,
  Placed,
  Stall,
  Restroom,
  Fountain,
  Torch,
  Neon,
  DanceFloorR,
  Scenery,
  Lights,
  ThemeRegion,
} from './wrappers';

// <Park> and <GameManager> are re-declared here as thin pass-throughs rather
// than bare `export { Park } from './parkRoot'` re-exports ON PURPOSE: the
// design-system prop extractor only reads THIS file, and a bare re-export
// hides the whole public prop surface (seed/size/climate/validate/…) from the
// generated component API. Props are listed explicitly and forwarded
// undefined-as-is, so every default still lives in exactly one place —
// parkRoot's destructuring defaults.
//
// THE `...rest` SPREAD IS LOad-BEARING — DO NOT REMOVE IT. Listing props
// explicitly is what the extractor needs, but it also means a prop added to
// ParkProps later is SILENTLY DROPPED here unless someone remembers to add it
// in two places. That is not hypothetical: `roster` was added to parkRoot,
// never added to this list, and was quietly discarded for every park using
// the public API — which made the whole rosterOverstated gate dead code until
// it was found by accident. The spread forwards anything not named above, so
// the failure mode is "the extractor does not advertise a new prop" (visible,
// harmless) instead of "the prop silently does nothing" (invisible, costly).
import React from 'react';
import { Park as ParkRoot, GameManager as GameManagerRoot } from './parkRoot';
import type { ParkProps, GameManagerProps } from './parkRoot';

export type { ParkProps, GameManagerProps } from './parkRoot';

export function Park({
  seed,
  climate,
  size,
  fullscreen,
  height,
  validate,
  guests,
  roster,
  background,
  fog,
  distance,
  cameraPose,
  quality,
  budgets,
  onReady,
  children,
  ...rest
}: ParkProps) {
  return (
    <ParkRoot
      seed={seed}
      climate={climate}
      size={size}
      fullscreen={fullscreen}
      height={height}
      validate={validate}
      guests={guests}
      roster={roster}
      background={background}
      fog={fog}
      distance={distance}
      cameraPose={cameraPose}
      quality={quality}
      budgets={budgets}
      onReady={onReady}
      {...rest}
    >
      {children}
    </ParkRoot>
  );
}

export function GameManager({ guests }: GameManagerProps) {
  return <GameManagerRoot guests={guests} />;
}

export type { ThemeRegionProps } from './wrappers';

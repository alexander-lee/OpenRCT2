import React, { useContext, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Stage } from '../Stage';
import type { StageApi } from '../Stage';
import { climateOf } from '../ParkBuilder';
import { ParkReactContext, makeStore, xzOf, yOf } from './parkContext';
import type { ParkContextValue, ParkPosition, ParkStore, V3, XZ } from './parkContext';

// ---- composable() / useComposable / <ScenePreview> — the fleet-wide convention ---------
//
// Every catalog component exports ONE React component that COMPOSES: it
// mounts its built group into the surrounding scene context (addObject,
// transform from props, cleanup + remount on prop change) and renders null.
// COMPONENTS NEVER RENDER A <Stage> THEMSELVES — the only Stage owners are
// the composition surfaces: <Park> (real parks) and <ScenePreview> (the
// preview host that *.previews.tsx files wrap components in, reproducing the
// classic standalone staging). Exemplars: FerrisWheel (ride registration),
// BurgerShop (stall registration), Torch, GrassTile. Migration checklist:
// components/Park/Context.md.

export interface ComposableBuilt {
  group: THREE.Group;
  update?: (time: number) => void;
  /** extra unmount hook — composable()'s `compose` extras chain in here */
  dispose?: () => void;
}

export interface ComposableProps {
  /** `[x, z]` (y settles onto the plaza/terrain) or `[x, y, z]` */
  position?: ParkPosition;
  /** Y yaw in radians */
  rotation?: number;
  scale?: number;
  /** extra remount key — composable() wires the component's non-transform
   *  props in here automatically so ANY prop change re-mounts the object */
  deps?: unknown;
}

export const toBuilt = (res: THREE.Group | ComposableBuilt): ComposableBuilt =>
  (res as THREE.Object3D).isObject3D ? { group: res as THREE.Group } : (res as ComposableBuilt);

/**
 * Mount a deterministic builder into the surrounding <Park>'s shared scene.
 * Returns TRUE when inside a <Park> (the group was mounted via addObject with
 * the prop transform — render null); FALSE outside one (render a standalone
 * Stage preview instead). Prop changes REMOUNT (rebuild + dispose), exactly
 * like every other Park wrapper. Keep `build` deterministic; its identity is
 * NOT a remount key (use `props.deps` for extra remount triggers).
 */
export function useComposable(
  build: (t: typeof THREE, park: ParkContextValue) => THREE.Group | ComposableBuilt,
  props: ComposableProps = {},
): boolean {
  const park = useContext(ParkReactContext);
  const buildRef = useRef(build);
  buildRef.current = build;
  const key = JSON.stringify([props.position ?? null, props.rotation ?? 0, props.scale ?? 1, props.deps ?? null]);
  useEffect(() => {
    if (!park) return;
    const t = park.three;
    // build*Scene misuse guard (best-effort name check — round-1 fix #5):
    // preview scene builders (build<Name>Scene) are STAGING for previews;
    // composed inside a real park they read as broken parks. The check only
    // sees named function props (wrapped arrows pass through undetected).
    if (!(park as ParkStore)._previewHost && /Scene$/.test(buildRef.current.name || ''))
      console.warn(
        `[Park] useComposable(build: ${buildRef.current.name}) looks like a preview SCENE builder (build<Name>Scene) — those are for previews; inside a <Park> use the component or its build<Name>() builder instead`,
      );
    const built = toBuilt(buildRef.current(t, park));
    const pos = props.position ?? ([0, 0] as XZ);
    const [x, z] = xzOf(pos);
    const y = yOf(pos) ?? park.floorAt(x, z);
    const g = new t.Group();
    g.add(built.group);
    g.position.set(x, y, z);
    g.rotation.y = props.rotation ?? 0;
    g.scale.setScalar(props.scale ?? 1);
    const cleanup = park.addObject(g, built.update);
    return () => {
      cleanup();
      built.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [park, key]);
  return park !== null;
}

/** composable() factory config */
export interface ComposableConfig<P extends object, B extends ComposableBuilt = ComposableBuilt> {
  /** default prop values (applied before `build`/`compose` see them) */
  props?: Partial<P>;
  /** registration hook, run right after the build mounts inside a REAL
   *  <Park> (never under <ScenePreview>): registerStall / registerRide +
   *  world-space grounding (berms, plinths — mount those via park.addObject
   *  and return its cleanup). `position` is the SETTLED world `[x, y, z]`.
   *  Manager registrations cannot be unregistered — remount the whole <Park>
   *  (key) to change sim config. */
  compose?: (
    park: ParkContextValue,
    info: { built: B; props: P; position: V3; rotation: number; scale: number },
  ) => (() => void) | void;
}

/**
 * The composable-component factory. `build(t, props, park)` is the
 * component's deterministic imperative builder. The returned component
 * mounts the built group into the surrounding scene context — a <Park> or a
 * <ScenePreview> — with the `position`/`rotation`/`scale` transform, runs the
 * optional `compose` registration hook (real parks only) and renders null.
 * Outside any scene context it renders nothing (previews must wrap it in
 * <ScenePreview> — components never own a <Stage>).
 */
export function composable<P extends object, B extends ComposableBuilt = ComposableBuilt>(
  displayName: string,
  build: (t: typeof THREE, props: P, park: ParkContextValue) => THREE.Group | B,
  cfg: ComposableConfig<P, B> = {},
): React.FC<P & ComposableProps> {
  const Component: React.FC<P & ComposableProps> = (all) => {
    const { position, rotation = 0, scale = 1, deps, ...rest } = all as ComposableProps & Record<string, unknown>;
    const props = { ...cfg.props, ...rest } as P;
    const inScene = useComposable(
      (t, park) => {
        const built = toBuilt(build(t, props, park)) as B;
        if (cfg.compose && !(park as ParkStore)._previewHost) {
          const pos = position ?? ([0, 0] as XZ);
          const [x, z] = xzOf(pos);
          const y = yOf(pos) ?? park.floorAt(x, z);
          const extra = cfg.compose(park, { built, props, position: [x, y, z], rotation, scale });
          if (extra) {
            const prev = built.dispose;
            built.dispose = () => {
              prev?.();
              extra();
            };
          }
        }
        return built;
      },
      { position, rotation, scale, deps: deps ?? rest },
    );
    if (!inScene) console.warn(`<${displayName}> must be rendered inside a <Park> or <ScenePreview> — nothing mounted`);
    return null;
  };
  Component.displayName = displayName;
  return Component;
}

// ---- <ScenePreview> — the preview host ---------------------------------------------------

export interface ScenePreviewProps {
  /** orbit radius (Stage default 8) */
  distance?: number;
  /** orbit target height (Stage default 0.7) */
  targetY?: number;
  autoRotate?: boolean;
  /** the grass ground disc (default true) */
  ground?: boolean;
  background?: string;
  night?: boolean;
  height?: number;
  fullscreen?: boolean;
  fog?: boolean | { near: number; far: number };
  /** terrain-follow clamp for terrain previews */
  groundAt?: (x: number, z: number) => number;
  seed?: number;
  /** extra imperative staging AROUND the composed children (plaza discs,
   *  boulders, camera work via the StageApi…) — return an updater if animated */
  dress?: (t: typeof THREE, g: THREE.Group, api: StageApi) => ((time: number) => void) | void;
  children?: React.ReactNode;
}

/**
 * The Stage host for *.previews.tsx files — the ONLY place besides <Park>
 * that renders a <Stage>. Provides the same scene context as <Park> (usePark
 * works; `floorAt`/`groundAt` return 0 on the flat preview ground) so
 * composable components mount into it declaratively:
 *
 *   <ScenePreview distance={9} targetY={2.4}><FerrisWheel /></ScenePreview>
 *
 * No GameManager, no validation, no UI windows — registration hooks
 * (`composable` cfg.compose) are skipped under a preview host.
 */
export function ScenePreview({
  distance,
  targetY,
  autoRotate = true,
  ground = true,
  background,
  night,
  height,
  fullscreen,
  fog,
  groundAt,
  seed = 1,
  dress,
  children,
}: ScenePreviewProps) {
  const [ctx, setCtx] = useState<ParkStore | null>(null);
  const dressRef = useRef(dress);
  dressRef.current = dress;
  return (
    <>
      <Stage
        distance={distance}
        targetY={targetY}
        autoRotate={autoRotate}
        ground={ground}
        background={background}
        night={night}
        height={height}
        fullscreen={fullscreen}
        fog={fog}
        groundAt={groundAt}
        build={(t, g, api) => {
          if (!api) throw new Error('<ScenePreview> requires the StageApi third build argument');
          const store = makeStore(t, g, api, { seed, size: 16, climate: climateOf(seed) });
          store._previewHost = true;
          const dressUpdate = dressRef.current?.(t, g, api) || undefined;
          setCtx(store);
          let last = 0;
          return (time) => {
            const dt = Math.min(Math.max(time - last, 0), 0.1);
            last = time;
            if (dressUpdate) dressUpdate(time);
            // previews run FULL-RATE, no LOD — screenshots stay pixel-identical
            store._entries.forEach((e) => e.update?.(time));
            store._managerInst?.update(time, dt);
          };
        }}
      />
      {ctx ? <ParkReactContext.Provider value={ctx}>{children}</ParkReactContext.Provider> : null}
    </>
  );
}

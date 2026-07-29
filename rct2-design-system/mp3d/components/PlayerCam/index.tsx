import * as THREE from 'three';
import { StageApi, StageViewportRect } from '../Stage';

// ---------------------------------------------------------------------------
// PlayerCam — an on-ride / chase camera bound to any vehicle Object3D and
// rendered as a Stage viewport inset (bottom-left by default, rules/ui.md).
// 'onboard' PARENTS the camera to the vehicle at seat height looking forward
// (zero-lag: the vehicle's world matrix carries it; cars orient local +z =
// travel direction — SplineCoaster run() makeBasis(side, up, fwd),
// components/SplineCoaster/index.tsx:455, so the camera yaws PI to look down
// its own -z along +z). 'chase' follows the vehicle's world matrix each frame
// via rAF: 2.2 behind along the travel direction, 0.9 up, looking at the
// vehicle. In BOTH modes the vehicle root is passed to addViewport's hide
// list, so it (and its riders) is invisible in the inset's render pass only —
// the POV shows the track ahead instead of the car blocking the camera.
// detach() removes the viewport, the camera and the rAF.
// ---------------------------------------------------------------------------

export type PlayerCamMode = 'onboard' | 'chase';

export interface PlayerCamOpts {
  mode?: PlayerCamMode;
  /** normalized inset rect — default bottom-left (rules/ui.md) */
  rect?: StageViewportRect;
  /** onboard: camera height above the vehicle origin (default 0.82).
   *
   *  Raised from 0.55 — a literal seated eye line — because on a coaster the
   *  view from a rider's actual eye height is BLOCKED. Seat-height puts the
   *  lens level with the car's own rollbar/headrest and barely above the rail
   *  tops, so on a descent the track surface immediately ahead fills the
   *  frame. Sitting it a head above the car clears the rails and shows the
   *  drop, which is the shot people want from an on-ride camera. */
  seatHeight?: number;
  /**
   * onboard: how much of the vehicle's PITCH the camera cancels, 0..1
   * (default 0.55; 0 restores the old rigidly-parented behaviour).
   *
   * THIS is the actual fix for "going down a slope you can't see anything".
   * The camera is parented to the car, so it inherits the car's full pitch and
   * then adds its own 0.12 rad of downward tilt on top — on a steep drop that
   * aims it into the track a few units ahead and the frame goes solid. A real
   * rider does not stare at their own feet on a descent; their head stays much
   * closer to the horizon. So the camera counter-rotates against the car's
   * pitch by this fraction, in BOTH directions: it looks up on a drop and down
   * on a climb (a climb otherwise fills the frame with sky).
   */
  levelPitch?: number;
  fov?: number;
  /** objects hidden during this inset's render pass so they can't block the
   *  POV (Stage addViewport hide list). Default: the vehicle root itself —
   *  its riders/children go invisible with it. Pass [] to keep it visible. */
  hide?: THREE.Object3D[];
}

export interface PlayerCamHandle {
  detach(): void;
  camera: THREE.PerspectiveCamera;
}

const DEFAULT_RECT: StageViewportRect = { x: 0.02, y: 0.68, w: 0.3, h: 0.3 };

export function attachPlayerCam(
  t: typeof THREE,
  api: StageApi,
  vehicle: THREE.Object3D,
  opts: PlayerCamOpts = {},
): PlayerCamHandle {
  const mode = opts.mode ?? 'onboard';
  const rect = opts.rect ?? DEFAULT_RECT;
  const cam = new t.PerspectiveCamera(opts.fov ?? 60, rect.w / rect.h, 0.05, 120);
  // the vehicle itself is hidden during the inset's render pass (Stage hide
  // list) so the POV shows the track ahead, not the car's interior/back
  const removeViewport = api.addViewport(cam, rect, { hide: opts.hide ?? [vehicle] });
  let raf = 0;

  if (mode === 'onboard') {
    // ride the vehicle's own world matrix
    cam.position.set(0, opts.seatHeight ?? 0.82, -0.05);
    cam.rotation.y = Math.PI; // camera -z spun onto the car's +z travel axis
    vehicle.add(cam);

    // PITCH LEVELLING. Parenting alone gives the camera the car's whole pitch,
    // so a drop points it at the track and a lift points it at the sky. Cancel
    // a fraction of it each frame so the view stays nearer the horizon, the way
    // a rider's head does.
    //
    // Sign convention: `rotation.y = π` has already spun the camera's -z onto
    // the car's +z, so a POSITIVE `rotation.x` looks DOWN. The car's travel
    // direction is its local +z, whose world Y is `matrixWorld` element 9 —
    // negative while descending. Adding `LEVEL · pitch` therefore looks UP on a
    // descent and DOWN on a climb, which is the correction we want in one term.
    const BASE_PITCH = 0.12; // the original slight nose-down, kept for the flat
    const LEVEL = Math.max(0, Math.min(1, opts.levelPitch ?? 0.55));
    const setPitch = () => {
      // no allocation: read the one matrix element we need
      const fwdY = Math.max(-1, Math.min(1, vehicle.matrixWorld.elements[9]));
      const pitch = Math.asin(fwdY); // <0 descending, >0 climbing
      cam.rotation.x = BASE_PITCH + LEVEL * pitch;
    };
    setPitch();
    if (LEVEL > 0) {
      const loop = () => {
        setPitch();
        raf = requestAnimationFrame(loop);
      };
      loop();
    }
  } else {
    // chase: re-pose from the vehicle's world matrix each frame
    api.scene.add(cam);
    const pos = new t.Vector3();
    const q = new t.Quaternion();
    const s = new t.Vector3();
    const fwd = new t.Vector3();
    const loop = () => {
      vehicle.matrixWorld.decompose(pos, q, s);
      fwd.set(0, 0, 1).applyQuaternion(q); // travel direction (local +z)
      cam.position.copy(pos).addScaledVector(fwd, -2.2); // 2.2 behind
      cam.position.y += 0.9; // + 0.9 up
      cam.lookAt(pos);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  return {
    camera: cam,
    detach() {
      cancelAnimationFrame(raf);
      removeViewport();
      cam.parent?.remove(cam);
    },
  };
}

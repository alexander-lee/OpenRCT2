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
  /** onboard: camera height above the vehicle origin (default 0.55 — a seated
   *  rider's eye line on the 0.5-scale peeps / kit cars) */
  seatHeight?: number;
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
    // ride the vehicle's own world matrix — no per-frame work needed
    cam.position.set(0, opts.seatHeight ?? 0.55, -0.05);
    cam.rotation.y = Math.PI; // camera -z spun onto the car's +z travel axis
    cam.rotation.x = 0.12; // slight downward pitch — keeps the track ahead in frame
    vehicle.add(cam);
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

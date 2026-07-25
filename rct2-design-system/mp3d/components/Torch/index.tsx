import * as THREE from 'three';
import { cyl, ball, box, mat, nightKOf } from '../Stage';
import { buildFire, Fire } from '../ParticleKit';
import { composable } from '../Park';

// ---------------------------------------------------------------------------
// Torch — a rustic park torch: tapered wooden pole with a wrapped leather
// grip band, an iron sconce head (collar, tapered basket cup, rim ring and
// four outward-tilted straps) holding a glowing coal bed, topped with a
// small ParticleKit buildFire flame whose warm point light flickers and
// brightens at night (nightKOf). Deterministic — hashed flicker only.
// ---------------------------------------------------------------------------

const IRON = 0x33353a;
const WOOD = 0x6b4a2a;
const LEATHER = 0x3a2417;

export interface TorchOpts {
  /** pole height in units (default 1.5) */
  height?: number;
  /** whether the torch burns (default true) — unlit keeps cold coals */
  lit?: boolean;
}

export function buildTorch(t: typeof THREE, opts: TorchOpts = {}): { group: THREE.Group; update: (time: number) => void } {
  const H = opts.height ?? 1.5;
  const lit = opts.lit ?? true;
  const grp = new t.Group();

  // rustic tapered pole, embedded 0.03 below the group origin for ground contact
  grp.add(cyl(t, 0.034, 0.048, H + 0.03, WOOD, [0, H / 2 - 0.03, 0], { tex: 'wood', repeat: [2, 4], rough: 0.95, seg: 10 }));
  // wrapped grip band ~40% up: four stacked leather rings
  for (let i = 0; i < 4; i++) {
    grp.add(cyl(t, 0.043, 0.043, 0.03, LEATHER, [0, H * 0.38 + i * 0.034, 0], { tex: 'fabric', repeat: [4, 1], rough: 1, seg: 10 }));
  }

  // iron sconce head: collar where the pole meets the basket…
  grp.add(cyl(t, 0.052, 0.038, 0.055, IRON, [0, H - 0.01, 0], { tex: 'metal', metal: 0.7, rough: 0.5, seg: 10 }));
  // …tapered basket cup…
  grp.add(cyl(t, 0.1, 0.05, 0.13, IRON, [0, H + 0.06, 0], { tex: 'metal', metal: 0.7, rough: 0.55, seg: 12 }));
  // …rim ring…
  const ring = new t.Mesh(new t.TorusGeometry(0.1, 0.012, 8, 20), mat(t, IRON, { tex: 'metal', repeat: [6, 1], metal: 0.7, rough: 0.5 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = H + 0.125;
  ring.castShadow = true;
  grp.add(ring);
  // …and four outward-tilted straps up the cup side
  for (let i = 0; i < 4; i++) {
    const th = (i / 4) * Math.PI * 2;
    const strap = box(t, [0.018, 0.15, 0.01], IRON, [0, 0, 0], { tex: 'metal', metal: 0.7, rough: 0.5 });
    strap.position.set(Math.cos(th) * 0.078, H + 0.06, Math.sin(th) * 0.078);
    strap.rotation.set(Math.sin(th) * 0.38, 0, -Math.cos(th) * 0.38);
    grp.add(strap);
  }

  // coal bed in the cup (emissive when lit) + the buildFire flame above it
  const coals = ball(t, 0.06, 0x241812, [0, H + 0.115, 0], { flat: true, emissive: lit ? 0xb03a08 : 0x000000, rough: 1 });
  coals.scale.y = 0.5;
  coals.castShadow = false;
  grp.add(coals);
  let fire: Fire | null = null;
  if (lit) {
    fire = buildFire(t, { scale: 0.34 });
    fire.group.position.y = H + 0.11;
    grp.add(fire.group);
  }

  const update = (time: number) => {
    if (!fire) return;
    fire.update(time); // flame layers + night-aware flickering light
    const nk = nightKOf(grp);
    (coals.material as THREE.MeshStandardMaterial).emissiveIntensity =
      (0.5 + 0.22 * Math.sin(time * 8.3) + 0.1 * Math.sin(time * 19.1)) * (0.8 + 0.8 * nk);
  };
  return { group: grp, update };
}

// ---------------------------------------------------------------------------
// <Torch> — the COMPOSABLE component (components/Park/Context.md convention):
// mounts one torch into the surrounding <Park> / <ScenePreview> at
// `position` (y settles onto the plaza/terrain), `rotation`, `scale`.
// The preview staging (three torches around a stone circle) lives in
// Torch.previews.tsx — components never render a <Stage> themselves.
// ---------------------------------------------------------------------------

export interface TorchProps {
  /** pole height in units (default 1.5) */
  height?: number;
  /** whether the torch burns (default true) — unlit keeps cold coals */
  lit?: boolean;
}

export const Torch = composable<TorchProps>('Torch', (t, { height = 1.5, lit = true }) => buildTorch(t, { height, lit }));

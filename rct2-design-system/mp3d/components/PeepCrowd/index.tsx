import React from 'react';
import * as THREE from 'three';
import { box } from '../Stage';
import { buildPeep, cadenceForSpeed, SKIN_TONES, SHIRTS, TROUSERS, HAIRS, Expression } from '../Guest';
import { composable } from '../Park';

// Peep CROWD — a milling plaza crowd of OUR buildPeep guests (~50% female,
// hashed), animated entirely through the Guest POSE LAYER. Deterministic
// golden-angle placement (no Math.random); guests are a mix of standers who
// glance around, idle weight-shifters (pose 'idle': breathing + slow weight
// shift), wanderers strolling small loops with a no-foot-skate cadence
// (pose 'walk' driven by actual ground speed) — and DANCERS with their HANDS
// IN THE AIR. `dance` (0..1) sets the fraction of the crowd dancing on a
// shared ~2.2 Hz beat in four hashed per-peep styles (bounce / twist / sway /
// spin-burst); the pose layer enriches each style with sequenced arm-waves,
// side-step shuffles and occasional full spins (crossfaded), female skirts
// swing and flare on the turns, and the spin-burst style throws real pose-
// layer JUMPS (anticipation crouch → arc → landing) every few bars.
// Varied skin tones, outfits, hair and expressions.

export interface CrowdOpts {
  count?: number;
  radius?: number;
  /** fraction of the crowd dancing (0..1), default 0.5 */
  dance?: number;
}

// deterministic pseudo-random from an integer key (hashed sine)
const hash01 = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const EXPRS: Expression[] = ['happy', 'neutral', 'surprised', 'happy', 'sad', 'happy', 'neutral'];
const GOLDEN = 2.399963229728653; // golden angle — even, deterministic scatter

// shared dance-floor beat, in Hz (the pose layer works in beats)
const BEAT_HZ = 2.2;
const PEEP_SCALE = 0.5;

export function buildCrowd(t: typeof THREE, opts: CrowdOpts = {}) {
  const count = opts.count ?? 14;
  const radius = opts.radius ?? 2.2;
  const dance = Math.max(0, Math.min(1, opts.dance ?? 0.5));
  const group = new t.Group();

  interface Milling {
    peep: ReturnType<typeof buildPeep>;
    carrier: THREE.Group;
    mode: 0 | 1 | 2; // 0 stand+glance, 1 idle weight-shift, 2 wander loop
    dancing: boolean;
    style: 0 | 1 | 2 | 3; // 0 bounce, 1 twist, 2 sway, 3 spin-burst
    hx: number;
    hz: number;
    yaw: number;
    phase: number;
    loopR: number;
    loopW: number;
    nextHop: number; // spin-burst: next pose-layer jump time
    lx: number; // last position — cadence from actual displacement
    lz: number;
  }

  const peeps: Milling[] = [];
  for (let i = 0; i < count; i += 1) {
    const peep = buildPeep(t, {
      skin: SKIN_TONES[Math.floor(hash01(i * 41 + 1) * SKIN_TONES.length)],
      shirt: SHIRTS[Math.floor(hash01(i * 41 + 2) * SHIRTS.length)],
      trousers: TROUSERS[Math.floor(hash01(i * 41 + 3) * TROUSERS.length)],
      hair: HAIRS[Math.floor(hash01(i * 41 + 4) * HAIRS.length)],
      expression: EXPRS[i % EXPRS.length],
      female: hash01(i * 41 + 11) < 0.5, // ~half the crowd, deterministic
    });
    peep.group.scale.setScalar(PEEP_SCALE);
    const carrier = new t.Group();
    carrier.add(peep.group);
    group.add(carrier);
    // even golden-angle spiral over the plaza
    const a = i * GOLDEN;
    const r = radius * Math.sqrt((i + 0.5) / count);
    peep.pose.seed = hash01(i * 41 + 6) * Math.PI * 2;
    peeps.push({
      peep,
      carrier,
      mode: (i % 3) as 0 | 1 | 2,
      dancing: false,
      style: (Math.floor(hash01(i * 41 + 10) * 4) % 4) as 0 | 1 | 2 | 3,
      hx: Math.cos(a) * r,
      hz: Math.sin(a) * r,
      yaw: hash01(i * 41 + 5) * Math.PI * 2,
      phase: hash01(i * 41 + 6) * Math.PI * 2,
      loopR: 0.3 + hash01(i * 41 + 7) * 0.3,
      loopW: 0.5 + hash01(i * 41 + 8) * 0.35,
      nextHop: 1 + hash01(i * 41 + 12) * 3.6,
      lx: Math.cos(a) * r,
      lz: Math.sin(a) * r,
    });
  }
  // deterministically pick round(count * dance) dancers, scattered over the
  // plaza by a per-index hash (no Math.random)
  const order = peeps.map((_, i) => i).sort((a, b) => hash01(a * 41 + 9) - hash01(b * 41 + 9));
  order.slice(0, Math.round(count * dance)).forEach((i) => (peeps[i].dancing = true));
  // cap each wander loop by the nearest neighbour so bodies never intersect:
  // loopR_i + loopR_j <= d(i,j) - 0.36 keeps every pair >= 0.36 apart
  // (dancers dance in place at their home spot, so they only shrink caps)
  peeps.forEach((p, i) => {
    if (p.dancing || p.mode !== 2) return;
    let dmin = Infinity;
    peeps.forEach((q, j) => {
      if (j !== i) dmin = Math.min(dmin, Math.hypot(q.hx - p.hx, q.hz - p.hz));
    });
    p.loopR = Math.min(p.loopR, Math.max(0.08, (dmin - 0.36) / 2));
  });

  // initial pose states — the controller crossfades every later change
  peeps.forEach((p) => {
    if (p.dancing) {
      p.peep.pose.setDanceStyle(p.style);
      p.peep.pose.setState('dance', BEAT_HZ);
    } else if (p.mode === 2) {
      p.peep.pose.setState('walk', 3);
    } else {
      p.peep.pose.setState('idle');
    }
  });

  let lastT: number | null = null;
  const update = (time: number) => {
    let dt = lastT == null ? 1 / 60 : time - lastT;
    lastT = time;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    peeps.forEach((p) => {
      const pose = p.peep.pose;
      if (p.dancing) {
        // the pose layer owns the whole body: beat-synced move sequences
        // (bounce / twist / sway / spins / arm-waves / shuffles) crossfading
        // per bar. Its spin offset is ADDED to the carrier yaw so full spins
        // really turn the body (and swirl the skirts); the spin-burst style
        // additionally throws a real pose-layer JUMP every few bars.
        p.carrier.position.set(p.hx, 0, p.hz);
        p.carrier.rotation.y = p.yaw + pose.spinYaw;
        if (p.style === 3 && time >= p.nextHop) {
          pose.setState('jump', 0.7); // auto-returns to 'dance' on landing
          p.nextHop = time + 8 / BEAT_HZ; // every 8 beats
        }
      } else if (p.mode === 0) {
        // standing, glancing around (pose 'idle' breathes underneath)
        p.carrier.position.set(p.hx, 0, p.hz);
        p.carrier.rotation.y = p.yaw + Math.sin(time * 0.5 + p.phase) * 0.35;
        p.peep.head.rotation.y = Math.sin(time * 0.8 + p.phase * 2) * 0.45;
      } else if (p.mode === 1) {
        // idle weight-shifting on the spot — pose 'idle' does the shifting
        p.carrier.position.set(p.hx, 0, p.hz);
        p.carrier.rotation.y = p.yaw;
      } else {
        // small wander loop around the home spot, facing the tangent; the
        // walk cadence comes from ACTUAL displacement so feet never skate
        const w = time * p.loopW + p.phase;
        const x = p.hx + Math.cos(w) * p.loopR;
        const z = p.hz + Math.sin(w) * p.loopR * 0.7;
        const dx = -Math.sin(w) * p.loopR;
        const dz = Math.cos(w) * p.loopR * 0.7;
        p.carrier.position.set(x, 0, z);
        p.carrier.rotation.y = Math.atan2(dx, dz);
        const speed = Math.hypot(x - p.lx, z - p.lz) / dt;
        p.lx = x;
        p.lz = z;
        pose.setState('walk', cadenceForSpeed(speed, PEEP_SCALE));
      }
      pose.update(time, dt);
    });
  };

  return { group, update };
}

// ~14 guests (about half female) on a concrete plaza slab — over half of them
// dancing to a shared beat with their hands in the air (bounce / twist / sway
// / spin-burst, enriched with arm-waves, shuffles and skirt-flaring spins),
// the rest milling as before.
export function buildPeepCrowdScene(three: typeof THREE): { group: THREE.Group; update?: (time: number) => void } {
  const group = new three.Group();
  const update =
    ((t: typeof THREE, g: THREE.Group) => {
        // plaza slab in our concrete texture, with joint seams
        const SLAB = 0xb0aca0;
        g.add(box(t, [5.6, 0.08, 5.6], SLAB, [0, 0.04, 0], { tex: 'concrete', repeat: [8, 8], rough: 0.95, bump: 0.02 }));
        for (let v = -2; v <= 2; v += 1) {
          g.add(box(t, [5.6, 0.012, 0.02], 0x8d8a80, [0, 0.083, v * 1.1], { rough: 1 }));
          g.add(box(t, [0.02, 0.012, 5.6], 0x8d8a80, [v * 1.1, 0.083, 0], { rough: 1 }));
        }
        const crowd = buildCrowd(t, { count: 14, radius: 2.2, dance: 0.6 });
        crowd.group.position.y = 0.08;
        g.add(crowd.group);
        return crowd.update;
      })(three, group) || undefined;
  return { group, update };
}

/** <PeepCrowd> — composable (components/Park/Context.md): mounts the scene at
 *  `position`/`rotation`/`scale` inside a <Park> or <ScenePreview>. */
export const PeepCrowd = composable('PeepCrowd', (t) => buildPeepCrowdScene(t));

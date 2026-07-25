// Candidate MineTrainCoaster circuits — compiled with the component's OWN
// options (profile coaster / type wooden / bank 0.42 / start [0,0.55,0] /
// heading -90°, i.e. the station straight runs along local -x).
import * as THREE from 'three';
import { compileTrackPieces, rateCoaster, rampPoints, replayCoasterForces } from '/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/mp3d/components/SplineRideKit';
import type { TrackPiece } from '/Users/alexanderlee/Desktop/OpenRCT2/rct2-design-system/mp3d/components/SplineRideKit';

const BANK = 0.42;
const OPTS = { profile: 'coaster' as const, type: 'wooden' as const, bank: BANK, start: [0, 0.55, 0] as [number, number, number], heading: -Math.PI / 2 };

const quiet = <T,>(fn: () => T): T => {
  const w = console.warn;
  const e = console.error;
  console.warn = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.warn = w;
    console.error = e;
  }
};

function planView(points: [number, number, number][], w = 78, h = 30) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(' '));
  const sx = (x: number) => Math.round(((x - x0) / Math.max(1e-6, x1 - x0)) * (w - 1));
  const sz = (z: number) => Math.round((1 - (z - z0) / Math.max(1e-6, z1 - z0)) * (h - 1));
  points.forEach((p, i) => {
    const y = p[1];
    const c = y > 3.5 ? '#' : y > 2.2 ? '+' : y > 1.2 ? '-' : '.';
    grid[sz(p[2])][sx(p[0])] = i === 0 ? 'S' : c;
  });
  console.log(`  plan (x ${x0.toFixed(1)}..${x1.toFixed(1)}, z ${z0.toFixed(1)}..${z1.toFixed(1)}; S=start . low - mid + high # top)`);
  grid.forEach((row) => console.log('  |' + row.join('')));
}

/** independent replica of compileTrackPieces' cursor walk (authored pieces
 *  only, no closure synthesis) so I can see where each piece LEAVES the train */
function poses(pieces: TrackPiece[]) {
  console.log('  piece-by-piece cursor (x, y, z | yaw°):');
  let yaw = OPTS.heading;
  const pos = { x: OPTS.start[0], y: OPTS.start[1], z: OPTS.start[2] };
  const baseY = OPTS.start[1];
  const dir = () => [Math.sin(yaw), Math.cos(yaw)] as [number, number];
  const straight = (len: number) => {
    const [dx, dz] = dir();
    pos.x += dx * len;
    pos.z += dz * len;
  };
  const ramp = (rise: number, run?: number) => {
    const [dx, dz] = dir();
    const r = Math.max(run ?? 0, 2.2, 1.9 * Math.abs(rise));
    const pts = rampPoints([pos.x, pos.y, pos.z], [dx, dz], { run: r, rise });
    const last = pts[pts.length - 1];
    pos.x = last[0];
    pos.y = last[1];
    pos.z = last[2];
    return Math.hypot(last[0] - (pts[0][0]), last[2] - pts[0][2]);
  };
  const arc = (s: 1 | -1, angleRad: number, R: number, dy = 0) => {
    const cx = pos.x + s * R * Math.cos(yaw);
    const cz = pos.z - s * R * Math.sin(yaw);
    const relX = pos.x - cx;
    const relZ = pos.z - cz;
    const a = s * angleRad;
    pos.x = cx + relX * Math.cos(a) + relZ * Math.sin(a);
    pos.z = cz - relX * Math.sin(a) + relZ * Math.cos(a);
    pos.y += dy;
    yaw += a;
  };
  const sbend = (len: number, off: number) => {
    const [dx, dz] = dir();
    pos.x += dx * len + Math.cos(yaw) * off;
    pos.z += dz * len - Math.sin(yaw) * off;
  };
  const DEG = Math.PI / 180;
  for (let n = 1; n <= pieces.length; n++) {
    const d0 = pieces[n - 1];
    const d = typeof d0 === 'string' ? { type: d0 } as any : (d0 as any);
    let note = '';
    switch (d.type) {
      case 'station': straight(d.length ?? 2.6); break;
      case 'flat': case 'straight': straight(d.length ?? 1.3); break;
      case 'lift': note = `run ${ramp(Math.abs(d.height ?? 1.5), d.length).toFixed(1)}`; break;
      case 'drop': note = `run ${ramp(-Math.abs(d.height ?? Math.max(0.55, pos.y - baseY)), d.length).toFixed(1)}`; break;
      case 'hill': {
        const h = Math.abs(d.height ?? 0.9);
        const L = Math.max(d.length ?? 0, 3.6, 6.3 * Math.sqrt(h));
        straight(L);
        note = `run ${L.toFixed(1)}`;
        break;
      }
      case 'turnL': case 'turnR': arc(d.type === 'turnL' ? 1 : -1, Math.abs(d.angle ?? 90) * DEG, Math.max(0.8, d.radius ?? 1.5)); break;
      case 'helixL': case 'helixR': arc(d.type === 'helixL' ? 1 : -1, Math.abs(d.angle ?? 360) * DEG, Math.max(1.0, d.radius ?? 1.5), d.height ?? 0); break;
      case 'sbend': sbend(Math.max(2.4, d.length ?? 3.6), d.radius ?? 1.2); break;
    }
    const b = [pos.x, pos.y, pos.z];
    const yawDeg = ((((yaw / DEG) % 360) + 540) % 360) - 180;
    const label = `${d.type}${d.height !== undefined ? ` h${d.height}` : ''}${d.length !== undefined ? ` l${d.length}` : ''}${d.angle !== undefined ? ` a${d.angle}` : ''}${d.radius !== undefined ? ` r${d.radius}` : ''}`;
    console.log(`   ${String(n).padStart(2)} ${label.padEnd(28)} (${b[0].toFixed(2)}, ${b[1].toFixed(2)}, ${b[2].toFixed(2)})  yaw ${yawDeg.toFixed(0)}°  ${note}`);
  }
  console.log(`   → residual gap to station ${Math.hypot(pos.x - OPTS.start[0], pos.z - OPTS.start[2]).toFixed(2)}, dy ${(pos.y - baseY).toFixed(2)}, yaw off ${((((yaw - OPTS.heading) / DEG) % 360 + 540) % 360 - 180).toFixed(0)}°`);
}

function grades(points: [number, number, number][]) {
  let worst = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dz = points[i][2] - points[i - 1][2];
    const dy = points[i][1] - points[i - 1][1];
    const g = Math.abs(Math.atan2(dy, Math.hypot(dx, dz)));
    worst = Math.max(worst, g);
  }
  return (worst * 180) / Math.PI;
}

export function probe(name: string, pieces: TrackPiece[], opts: { plan?: boolean; walk?: boolean } = {}) {
  console.log(`\n=== ${name} (${pieces.length} pieces) ===`);
  const warnings: string[] = [];
  const { points, report } = (() => {
    const w = console.warn;
    console.warn = (m: string) => warnings.push(String(m));
    try {
      return compileTrackPieces(pieces, OPTS);
    } finally {
      console.warn = w;
    }
  })();
  const r = rateCoaster(points, { type: 'wooden', bank: BANK, cars: 3 });
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  const ys = points.map((p) => p[1]);
  console.log(
    `  ok=${report.ok} fatal=${report.fatal ?? false}${report.fatalReason ? ` (${report.fatalReason})` : ''}\n` +
      `  design.ok=${report.design.ok} violations=${report.design.violations.length}\n` +
      `  clearance worst=${report.valid.worst.toFixed(2)} ok=${report.valid.ok}\n` +
      `  closure closed=${report.closure.closed} gap=${report.closure.gap.toFixed(2)} synthesized=[${report.closure.synthesized.join(', ')}]\n` +
      `  peak grade=${grades(points).toFixed(1)}°  summit y=${Math.max(...ys).toFixed(2)}  bbox x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)} z ${Math.min(...zs).toFixed(1)}..${Math.max(...zs).toFixed(1)}\n` +
      `  ratings E ${r.excitement.toFixed(2)} / I ${r.intensity.toFixed(2)} / N ${r.nausea.toFixed(2)} (${r.ratingBand}) maxLatG ${r.maxLatG.toFixed(2)} maxSpeed ${r.maxSpeed.toFixed(1)}mph highestDrop ${r.highestDrop.toFixed(2)} drops ${r.dropCount} airtime ${r.airtimeSeconds.toFixed(2)}s len ${r.length.toFixed(1)} dur ${r.duration.toFixed(0)}s`,
  );
  {
    const rep = replayCoasterForces(THREE, points, { bank: BANK });
    const top = [...rep.samples].sort((a, b) => b.latAccel - a.latAccel).slice(0, 5);
    console.log('  worst lateral samples (u, y, v, roll°, latG, vertG):');
    top.forEach((s2) => console.log(`    u=${s2.u.toFixed(3)} y=${s2.y.toFixed(2)} v=${s2.v.toFixed(2)} roll=${((s2.roll * 180) / Math.PI).toFixed(1)}° latG=${(s2.latAccel / 9.81).toFixed(2)} vertG=${s2.vertG.toFixed(2)}`));
    const negs = [...rep.samples].sort((a, b) => a.vertG - b.vertG).slice(0, 2);
    negs.forEach((s2) => console.log(`    minVertG u=${s2.u.toFixed(3)} vertG=${s2.vertG.toFixed(2)}`));
  }
  report.design.violations.forEach((v) => console.log(`  ${v.warning ? 'WARN' : 'VIOLATION'} [${v.kind}] u=${v.at.toFixed(2)} ${v.detail}`));
  warnings.forEach((m) => console.log(`  warn: ${m}`));
  if (opts.walk) poses(pieces);
  if (opts.plan !== false) planView(points);
  return { points, report, r };
}

// ---------------------------------------------------------------------------
const DEFAULT_PIECES: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 3.6, length: 6.8 },
  { type: 'straight', length: 0.8 },
  { type: 'helixR', angle: 360, radius: 2.8, height: -1.15 },
  { type: 'helixR', angle: 180, radius: 4.25, height: -0.45 },
  { type: 'straight', length: 1.2 },
  { type: 'drop', height: 2.0, length: 4.2 },
  { type: 'straight', length: 6.4 },
  { type: 'turnR', angle: 40, radius: 7.0 },
  { type: 'turnR', angle: 100, radius: 3.4 },
  { type: 'turnR', angle: 40, radius: 7.0 },
  { type: 'straight', length: 1.2 },
];
probe('stock Gold Gulch (DEFAULT_PIECES)', DEFAULT_PIECES, { walk: true });

const A: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 4.5, length: 9.0 },
  { type: 'straight', length: 0.8 },
  { type: 'helixR', angle: 180, radius: 4.84, height: -0.5 },
  { type: 'straight', length: 1.0 },
  { type: 'drop', height: 4.0, length: 8.0 },
  { type: 'straight', length: 5.35 },
  { type: 'turnR', angle: 8, radius: 14 },
  { type: 'turnR', angle: 15, radius: 9 },
  { type: 'turnR', angle: 30, radius: 6 },
  { type: 'turnR', angle: 74, radius: 3.6 },
  { type: 'turnR', angle: 30, radius: 6 },
  { type: 'turnR', angle: 15, radius: 9 },
  { type: 'turnR', angle: 8, radius: 14 },
  { type: 'straight', length: 1.4 },
];
probe('A v6 — curvature-ramped turnaround', A, { walk: true, plan: false });

const RAMPED_180: TrackPiece[] = [
  { type: 'turnR', angle: 8, radius: 14 },
  { type: 'turnR', angle: 15, radius: 9 },
  { type: 'turnR', angle: 30, radius: 6 },
  { type: 'turnR', angle: 74, radius: 3.6 },
  { type: 'turnR', angle: 30, radius: 6 },
  { type: 'turnR', angle: 15, radius: 9 },
  { type: 'turnR', angle: 8, radius: 14 },
];

const B: TrackPiece[] = [
  'station',
  { type: 'straight', length: 0.6 },
  { type: 'lift', height: 4.4, length: 9.0 },
  { type: 'straight', length: 0.8 },
  { type: 'helixR', angle: 360, radius: 3.0, height: -1.15 },
  { type: 'straight', length: 1.2 },
  { type: 'turnR', angle: 180, radius: 4.84 },
  { type: 'straight', length: 1.0 },
  { type: 'drop', height: 3.25, length: 6.5 },
  { type: 'straight', length: 7.36 },
  ...RAMPED_180,
  { type: 'straight', length: 1.4 },
];
probe('B v2 — Ore Bin Spiral', B, { walk: true, plan: false });

// ---------------------------------------------------------------------------
// FRAMING solver — PERSPECTIVE-correct (the orthographic version missed the
// near-field: a 30-unit circuit rotated past broadside swings one end almost
// into the camera). Newton-ish: solve `position` so the projected NDC bbox is
// centred, and scale the camera radius until the bbox fills `fill` of the frame.
function frame(name: string, pieces: TrackPiece[], rot: number, height = 340, fill = 0.88, elevDeg = 24, targetY = 2.4) {
  const { points } = quiet(() => compileTrackPieces(pieces, OPTS));
  const cloud: [number, number, number][] = [];
  const PAD = 2.4; // lineside boulders / portal mound sit up to ~2.4 u off the rail
  for (const [x, y, z] of points) {
    for (const dx of [-PAD, 0, PAD]) for (const dz of [-PAD, 0, PAD]) cloud.push([x + dx, y, z + dz]);
    cloud.push([x, 0, z]);
  }
  ([[-5.2, 3.2, 2.3], [-0.5, 1.9, 2.55], [-1.3, 1.8, 1.0], [-2.9, 0.4, 2.9]] as [number, number, number][]).forEach((p) => cloud.push(p));
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const local = cloud.map(([x, y, z]) => [x * cs + z * sn, y, -x * sn + z * cs] as [number, number, number]);
  const vFov = (34 * Math.PI) / 180;
  const E = (elevDeg * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = (900 / height) * tanV;
  const bbox = (px: number, pz: number, k: number) => {
    const R = k * Math.SQRT2;
    const cam = [k, targetY + R * Math.tan(E), k];
    const f = [-cam[0], targetY - cam[1], -cam[2]];
    const fl = Math.hypot(...f);
    const fu = f.map((c) => c / fl);
    const r = [fu[2], 0, -fu[0]];
    const rl = Math.hypot(...r);
    const ru = r.map((c) => c / rl);
    const uu = [ru[1] * fu[2] - ru[2] * fu[1], ru[2] * fu[0] - ru[0] * fu[2], ru[0] * fu[1] - ru[1] * fu[0]];
    let xm = 1e9, xM = -1e9, ym = 1e9, yM = -1e9, nearest = 1e9;
    for (const p of local) {
      const v = [p[0] + px - cam[0], p[1] - cam[1], p[2] + pz - cam[2]];
      const df = v[0] * fu[0] + v[1] * fu[1] + v[2] * fu[2];
      if (df < 0.4) return null; // behind / at the camera
      nearest = Math.min(nearest, df);
      const hx = (v[0] * ru[0] + v[1] * ru[1] + v[2] * ru[2]) / (df * tanH);
      const hy = (v[0] * uu[0] + v[1] * uu[1] + v[2] * uu[2]) / (df * tanV);
      xm = Math.min(xm, hx); xM = Math.max(xM, hx); ym = Math.min(ym, hy); yM = Math.max(yM, hy);
    }
    return { xm, xM, ym, yM, cam, nearest };
  };
  let px = 0, pz = 0, k = 30;
  for (let it = 0; it < 400; it++) {
    const b0 = bbox(px, pz, k);
    if (!b0) { k *= 1.2; continue; }
    const mx = (b0.xm + b0.xM) / 2, my = (b0.ym + b0.yM) / 2;
    const need = Math.max((b0.xM - b0.xm) / (2 * fill), (b0.yM - b0.ym) / (2 * fill));
    const eps = 0.4;
    const bx = bbox(px + eps, pz, k), bz2 = bbox(px, pz + eps, k);
    if (!bx || !bz2) { k *= 1.2; continue; }
    const j11 = ((bx.xm + bx.xM) / 2 - mx) / eps, j21 = ((bx.ym + bx.yM) / 2 - my) / eps;
    const j12 = ((bz2.xm + bz2.xM) / 2 - mx) / eps, j22 = ((bz2.ym + bz2.yM) / 2 - my) / eps;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) > 1e-6) {
      const dx = (-mx * j22 + my * j12) / det;
      const dz = (-my * j11 + mx * j21) / det;
      px += 0.5 * dx; pz += 0.5 * dz;
    }
    k *= 1 + (need - 1) * 0.35;
  }
  const b = bbox(px, pz, k)!;
  console.log(
    `\n[frame ${name}] rot ${(rot / Math.PI).toFixed(3)}π h${height} fill${fill} elev${elevDeg}°:\n` +
      `   position={[${px.toFixed(2)}, ${pz.toFixed(2)}]}  dress pose [${b.cam[0].toFixed(2)}, ${b.cam[1].toFixed(2)}, ${b.cam[2].toFixed(2)}] target [0, ${targetY}, 0]\n` +
      `   distance ${Math.hypot(b.cam[0], b.cam[1] - targetY, b.cam[2]).toFixed(1)}  ndc x ${b.xm.toFixed(2)}..${b.xM.toFixed(2)} y ${b.ym.toFixed(2)}..${b.yM.toFixed(2)}  nearest ${b.nearest.toFixed(1)} u`,
  );
}
frame('A lead h300', A, Math.PI * 0.42, 300, 0.9);
frame('B alt h300', B, Math.PI * 0.42, 300, 0.9);
frame('B alt h300 broadside', B, Math.PI * 0.25, 300, 0.9);

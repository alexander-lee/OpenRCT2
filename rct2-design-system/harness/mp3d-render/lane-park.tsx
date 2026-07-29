// ---------------------------------------------------------------------------
// lane-park.tsx — HARNESS-ONLY test park for measuring RIDE ACCESS JOINS.
//
// Six rides hung off one street lattice on real (undulating) terrain, so a
// CONSTANT offset across rides is distinguishable from a per-ride layout slip.
// The <LaneProbe> child installs `window.__laneProbe()`, which raycasts the
// RENDERED scene at the four joins that matter and returns every hit with its
// material colour, so a seam (0.009 proud) or a kerb (0.01 proud) can never be
// mistaken for the slab it sits on.
//
//   queue HEAD  — lane surface vs the entrance hut's apron slab
//   queue TAIL  — lane surface vs the street walking surface at the tail node
//   exit  START — exit-path surface vs the exit hut's apron slab
//   exit  END   — exit-path surface vs the street it joins
// ---------------------------------------------------------------------------
import React from 'react';
import * as THREE from 'three';
import { Park, GameManager, Terrain, Paths, Gate, usePark } from '../../mp3d/components/Park';
import { TILE } from '../../mp3d/components/ParkBuilder';
import { Teacups } from '../../mp3d/components/Teacups';
import { Carousel } from '../../mp3d/components/Carousel';
import { TwistRide } from '../../mp3d/components/TwistRide';
import { FerrisWheel } from '../../mp3d/components/FerrisWheel';
import { SwingRide } from '../../mp3d/components/SwingRide';
import { BumperCars } from '../../mp3d/components/BumperCars';

const G = TILE;
const SEED = 7;
/** laneLenOf(4) = max(2.2, 1.1 + 0.56·4) = 3.34, + the 0.35 join */
const REACH = 3.34 + 0.35;
/** the three ride ROWS (z), five tiles apart so no hut/lane pair can collide */
const ROWS = [5 * G, 0, -5 * G];
/** queue tail node x (both sides) and the ride pad x */
const TAIL_X = 2 * G;
const PAD_X = 7 * G;

const NODES: [number, number][] = [
  [0, 13 * G], // 0 gate
  [0, 12 * G], // 1
  [0, 8 * G], // 2
  [0, 5 * G], // 3  row 0
  [0, 4 * G], // 4
  [0, 3 * G], // 5
  [0, 2 * G], // 6
  [0, 1 * G], // 7
  [0, 0], // 8      row 1
  [0, -1 * G], // 9
  [0, -2 * G], // 10
  [0, -3 * G], // 11
  [0, -4 * G], // 12
  [0, -5 * G], // 13 row 2
  // the six arms: spine -> mid -> tail node
  [1 * G, 5 * G], // 14
  [2 * G, 5 * G], // 15  R1 tail
  [-1 * G, 5 * G], // 16
  [-2 * G, 5 * G], // 17 R2 tail
  [1 * G, 0], // 18
  [2 * G, 0], // 19      R3 tail
  [-1 * G, 0], // 20
  [-2 * G, 0], // 21     R4 tail
  [1 * G, -5 * G], // 22
  [2 * G, -5 * G], // 23 R5 tail
  [-1 * G, -5 * G], // 24
  [-2 * G, -5 * G], // 25 R6 tail
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13],
  [3, 14], [14, 15],
  [3, 16], [16, 17],
  [8, 18], [18, 19],
  [8, 20], [20, 21],
  [13, 22], [22, 23],
  [13, 24], [24, 25],
];
const KEEP_DRY: [number, number][] = [
  ...NODES,
  ...EDGES.map(([a, b]) => [(NODES[a][0] + NODES[b][0]) / 2, (NODES[a][1] + NODES[b][1]) / 2] as [number, number]),
  // pads, huts and lane runs on both sides of every row
  ...ROWS.flatMap((z) =>
    [1, -1].flatMap((s) => [
      [s * PAD_X, z] as [number, number],
      [s * (PAD_X - 1.2), z] as [number, number],
      [s * (PAD_X + 1.2), z] as [number, number],
      [s * (PAD_X - 2.4), z] as [number, number],
      [s * (TAIL_X + 1.2), z] as [number, number],
      [s * (TAIL_X + 2.4), z] as [number, number],
      [s * (PAD_X - 1.2), z + 1.2] as [number, number],
      [s * (PAD_X - 1.2), z - 1.2] as [number, number],
      [s * (TAIL_X + 2.4), z + 1.2] as [number, number],
      [s * (TAIL_X + 2.4), z - 1.2] as [number, number],
    ]),
  ),
];

function LaneProbe() {
  const park = usePark('lane probe');
  React.useEffect(() => {
    (window as unknown as { __laneProbe?: unknown }).__laneProbe = () => {
      const mgr = park.manager();
      const paths = park.paths as unknown as {
        walkYAt?: (x: number, z: number) => number;
        surfaceYAt?: (x: number, z: number) => number;
        pathY: number;
      };
      const walkY = (x: number, z: number) => paths.walkYAt?.(x, z) ?? paths.pathY + 0.09;
      const surfY = (x: number, z: number) => paths.surfaceYAt?.(x, z) ?? walkY(x, z);
      const fps = mgr.footprints();
      const ap = mgr.accessPoints();
      const canvas = document.querySelector('canvas') as unknown as { __stageApi?: { scene: THREE.Scene } };
      const scene = canvas?.__stageApi?.scene;
      if (!scene) return { error: 'no stage scene' };
      scene.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      /** the NAME of the hit part: Stage bakes colour into the texture and
       *  leaves material.color white, so colour cannot identify a slab. Walk up
       *  to the nearest named ancestor instead (queuePave / exitPave / exitKerb /
       *  exitSeam / hutGround / streetPave / streetKerb / streetSeam / …). */
      const tagOf = (o: THREE.Object3D | null) => {
        const trail: string[] = [];
        let n: THREE.Object3D | null = o;
        while (n) {
          if (n.name) trail.push(n.name);
          n = n.parent;
        }
        return trail;
      };
      /** every downward hit at (x, z), topmost first */
      const hitsAt = (x: number, z: number, n = 6) => {
        ray.set(new THREE.Vector3(x, 60, z), down);
        ray.far = 300;
        const hs = ray.intersectObject(scene, true);
        const out: { y: number; tag: string[] }[] = [];
        for (const h of hs) {
          out.push({ y: +h.point.y.toFixed(5), tag: tagOf(h.object) });
          if (out.length >= n) break;
        }
        return out;
      };
      /** the HIGHEST hit whose trail contains one of `want`, sampled at five
       *  LATERAL offsets — the landmine: a single cross-section sample can land
       *  on an expansion seam (0.009 proud) or a kerb (0.01 proud) and mask the
       *  slab under it, so take the best of several offsets and keep the tag. */
      const scan = (x: number, z: number, px: number, pz: number, want: string[]) => {
        let best: { y: number; tag: string[]; lat: number } | null = null;
        for (const lat of [-0.1, -0.05, 0, 0.05, 0.1]) {
          for (const h of hitsAt(x + px * lat, z + pz * lat, 10))
            if (h.tag.some((tg) => want.includes(tg)) && (!best || h.y > best.y)) best = { ...h, lat };
        }
        return best;
      };
      // SCENE CENSUS — how many path networks / lanes are actually mounted. A
      // <Paths> re-settle rebuilds the network; a stale one left in the scene
      // would put a second slab under every street and confound every reading.
      const census: Record<string, number> = {};
      const bounds: Record<string, [number, number]> = {};
      scene.traverse((o) => {
        if (!o.name) return;
        census[o.name] = (census[o.name] ?? 0) + 1;
        if (o.name === 'streetPave') {
          const m = o as THREE.Mesh;
          m.geometry.computeBoundingBox();
          const bb = m.geometry.boundingBox!;
          bounds[`streetPave#${census[o.name]}`] = [+bb.min.y.toFixed(4), +bb.max.y.toFixed(4)];
        }
      });
      // the NODE TABLE near each ride's tail — street node vs the logical spur
      // `routing.attach` pushed at the same cell, with their resolved heights
      const pp = park.paths as unknown as { net: { nodes: number[][] }; nodeY?: number[]; pathY: number; streetNodes: number };
      const nodesNear = (x: number, z: number) =>
        pp.net.nodes
          .map((n, i) => ({ i, x: n[0], z: n[1], ny: +(pp.nodeY?.[i] ?? 0).toFixed(4), street: i < pp.streetNodes }))
          .filter((n) => Math.hypot(n.x - x, n.z - z) < 0.7);
      const out = ap.rides.map((r) => {
        const res: Record<string, unknown> = { name: r.name };
        const laneRect = fps.find((f) => f.label === `${r.name} queue lane`);
        if (laneRect) {
          const dir: [number, number] = [Math.sin(laneRect.yaw), Math.cos(laneRect.yaw)];
          const px = dir[1];
          const pz = -dir[0];
          const len = laneRect.hz * 2;
          const ax = laneRect.cx - dir[0] * laneRect.hz;
          const az = laneRect.cz - dir[1] * laneRect.hz;
          const tail: [number, number] = [ax + dir[0] * (len + 0.35), az + dir[1] * (len + 0.35)];
          res.lane = {
            len: +len.toFixed(3),
            anchor: [+ax.toFixed(3), +az.toFixed(3)],
            tailNode: tail.map((v) => +v.toFixed(3)),
            // BOTH surfaces at ONE xz — the hut's front apron reaches 0.05 past
            // the anchor and the lane slab starts AT it, so 0.02 in is inside
            // both. Sampling them at different x would read the ramp's own
            // grade as a step (up to 3 mm on these lanes) and prove nothing.
            head: scan(ax + dir[0] * 0.02, az + dir[1] * 0.02, px, pz, ['queuePave']),
            hutApron: scan(ax + dir[0] * 0.02, az + dir[1] * 0.02, px, pz, ['hutGround']),
            end: scan(ax + dir[0] * (len - 0.08), az + dir[1] * (len - 0.08), px, pz, ['queuePave']),
            // is there PAVEMENT at the tail node cell at all?
            tailPave: scan(tail[0], tail[1], px, pz, ['streetPave', 'streetKerb', 'streetSeam']),
            // THE STEP, measured as two surfaces at ONE xz: the lane's last
            // 3 cm and the street slab that overlaps it there (the tail node's
            // junction pad reaches 0.61 back toward the lane, so both exist)
            overlapLane: scan(ax + dir[0] * (len - 0.03), az + dir[1] * (len - 0.03), px, pz, ['queuePave']),
            overlapStreet: scan(ax + dir[0] * (len - 0.03), az + dir[1] * (len - 0.03), px, pz, ['streetPave']),
            // the two samplers AT the lane's physical end, for diagnosis
            atEnd: {
              walkY: +walkY(ax + dir[0] * len, az + dir[1] * len).toFixed(5),
              surfY: +surfY(ax + dir[0] * len, az + dir[1] * len).toFixed(5),
              paveHits: hitsAt(ax + dir[0] * len, az + dir[1] * len, 6),
            },
            tailHits: hitsAt(tail[0], tail[1], 5),
            streetAtTail: +walkY(tail[0], tail[1]).toFixed(5),
            nodesNearTail: nodesNear(tail[0], tail[1]),
            pathY: pp.pathY,
            headHits: hitsAt(ax + dir[0] * 0.08, az + dir[1] * 0.08, 5),
          };
        }
        const ex = r.exitDir;
        const epx = ex[1];
        const epz = -ex[0];
        const sx = r.exitAt[0] + ex[0] * 0.62;
        const sz = r.exitAt[1] + ex[1] * 0.62;
        res.exit = {
          laneLen: +r.exitLaneLen.toFixed(3),
          at: r.exitAt.map((v) => +v.toFixed(3)),
          end: r.exitLaneEnd.map((v) => +v.toFixed(3)),
          // the exit hut's back apron reaches 0.67 out from the hut centre and
          // the exit path starts at 0.62, so 0.64 is inside both
          hutApron: scan(r.exitAt[0] + ex[0] * 0.64, r.exitAt[1] + ex[1] * 0.64, epx, epz, ['hutGround']),
          start: scan(r.exitAt[0] + ex[0] * 0.64, r.exitAt[1] + ex[1] * 0.64, epx, epz, ['exitPave']),
          endSurf: scan(r.exitLaneEnd[0] - ex[0] * 0.1, r.exitLaneEnd[1] - ex[1] * 0.1, epx, epz, ['exitPave']),
          // THE STEP at the street, both surfaces at ONE xz
          overlapExit: scan(r.exitLaneEnd[0] - ex[0] * 0.03, r.exitLaneEnd[1] - ex[1] * 0.03, epx, epz, ['exitPave']),
          overlapStreet: scan(r.exitLaneEnd[0] - ex[0] * 0.03, r.exitLaneEnd[1] - ex[1] * 0.03, epx, epz, ['streetPave']),
          streetAtEnd: +walkY(r.exitLaneEnd[0], r.exitLaneEnd[1]).toFixed(5),
          startHits: hitsAt(sx + ex[0] * 0.1, sz + ex[1] * 0.1, 5),
          endHits: hitsAt(r.exitLaneEnd[0] - ex[0] * 0.1, r.exitLaneEnd[1] - ex[1] * 0.1, 5),
        };
        return res;
      });
      return { rides: out, census, bounds, stats: mgr.stats() };
    };
  });
  return null;
}

/**
 * FIXED-ANGLE SHOTS of the four joins. <ScenePreview>/<Stage> AUTO-ROTATES and
 * exposes no camera prop, so a normal render is taken from whatever azimuth the
 * page drifted to and cannot be used to judge whether a slab meets a slab. These
 * are ORTHOGRAPHIC ELEVATIONS at poses derived from the rig's own geometry —
 * looking along the lane's LATERAL axis, so a step reads as a step — plus one
 * guest's-eye perspective standing in the queue.
 */
function LaneShots() {
  const park = usePark('lane shots');
  React.useEffect(() => {
    (window as unknown as { __laneShots?: unknown }).__laneShots = (rideName: string) => {
      const mgr = park.manager();
      const ap = mgr.accessPoints();
      const r = ap.rides.find((x) => x.name === rideName) ?? ap.rides[0];
      const fps = mgr.footprints();
      const laneRect = fps.find((f) => f.label === `${r.name} queue lane`)!;
      const dir: [number, number] = [Math.sin(laneRect.yaw), Math.cos(laneRect.yaw)];
      const px = dir[1];
      const pz = -dir[0];
      const len = laneRect.hz * 2;
      const ax = laneRect.cx - dir[0] * laneRect.hz;
      const az = laneRect.cz - dir[1] * laneRect.hz;
      const canvas = document.querySelector('canvas') as unknown as { __stageApi?: { scene: THREE.Scene } };
      const scene = canvas!.__stageApi!.scene;
      scene.updateMatrixWorld(true);
      const paths = park.paths as unknown as { surfaceYAt?: (x: number, z: number) => number };
      const sy = (x: number, z: number) => paths.surfaceYAt?.(x, z) ?? 0.09;
      const host = document.createElement('div');
      host.id = 'shots';
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:99;display:flex;flex-wrap:wrap;background:#111';
      document.body.appendChild(host);
      const CELL = 460;
      const shot = (tag: string, cam: THREE.Camera) => {
        const cell = document.createElement('div');
        cell.style.cssText = `position:relative;width:${CELL}px;height:${CELL}px`;
        const lab = document.createElement('div');
        lab.textContent = tag;
        lab.style.cssText = 'position:absolute;left:6px;top:4px;z-index:2;font:12px monospace;color:#fff;text-shadow:0 1px 2px #000';
        cell.appendChild(lab);
        host.appendChild(cell);
        const rend = new THREE.WebGLRenderer({ antialias: true });
        rend.setSize(CELL, CELL);
        rend.render(scene, cam);
        const img = new Image();
        img.src = rend.domElement.toDataURL();
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        cell.appendChild(img);
        rend.dispose();
      };
      /**
       * An ortho ELEVATION looking along the lane's LATERAL axis at (x, z).
       *
       * The near/far planes cut a THIN SLICE (D ± 0.6 u) around the join. An
       * elevation with the usual wide-open frustum looks straight THROUGH the
       * terrain and the rides between the camera and the subject, and the first
       * version of this shot produced four pictures of a hillside and a lake.
       */
      const D = 3;
      const elevation = (tag: string, x: number, z: number, span: number, side = 1) => {
        const h = span / 2;
        const cam = new THREE.OrthographicCamera(-h, h, h, -h, D - 0.34, D + 0.34);
        cam.position.set(x + px * D * side, sy(x, z) - 0.02, z + pz * D * side);
        cam.up.set(0, 1, 0);
        cam.lookAt(x, sy(x, z) - 0.02, z);
        cam.updateMatrixWorld(true);
        shot(tag, cam);
      };
      elevation(`${r.name}: QUEUE HEAD vs ENTRANCE HUT (elev, span 0.6 — hut apron LEFT, queue slab RIGHT)`, ax + dir[0] * 0.04, az + dir[1] * 0.04, 0.6);
      elevation(`${r.name}: QUEUE TAIL vs STREET (elev, span 0.6 — queue slab LEFT, street RIGHT)`, ax + dir[0] * (len + 0.02), az + dir[1] * (len + 0.02), 0.6);
      elevation(
        `${r.name}: EXIT PATH vs STREET (elev, span 0.6)`,
        r.exitLaneEnd[0] - r.exitDir[0] * 0.04,
        r.exitLaneEnd[1] - r.exitDir[1] * 0.04,
        0.6,
      );
      // GUEST'S EYE: standing at the tail of the queue, looking up the lane at
      // the entrance hut. 0.42 u is a 0.5-scale peep's eye height.
      const gx = ax + dir[0] * (len - 0.1);
      const gz = az + dir[1] * (len - 0.1);
      const gcam = new THREE.PerspectiveCamera(58, 1, 0.02, 60);
      gcam.position.set(gx, sy(gx, gz) + 0.42, gz);
      gcam.lookAt(ax - dir[0] * 0.6, sy(ax, az) + 0.25, az - dir[1] * 0.6);
      gcam.updateMatrixWorld(true);
      shot(`${r.name}: GUEST'S EYE down the queue -> hut`, gcam);
      // …and the reverse, a rider leaving: on the exit apron looking out the run
      const ex = r.exitAt[0] + r.exitDir[0] * 0.66;
      const ez = r.exitAt[1] + r.exitDir[1] * 0.66;
      const ecam = new THREE.PerspectiveCamera(58, 1, 0.02, 60);
      ecam.position.set(ex, sy(ex, ez) + 0.42, ez);
      ecam.lookAt(r.exitLaneEnd[0], sy(r.exitLaneEnd[0], r.exitLaneEnd[1]) + 0.1, r.exitLaneEnd[1]);
      ecam.updateMatrixWorld(true);
      shot(`${r.name}: RIDER'S EYE leaving the exit -> street`, ecam);
      return { ok: true, cells: host.children.length };
    };
  });
  return null;
}

export function LanePark() {
  return (
    <Park
      seed={SEED}
      climate="temperate"
      size={32}
      guests={10}
      fullscreen
      onReady={(report) => {
        (window as unknown as { __parkReport?: unknown }).__parkReport = report ?? { skipped: true };
      }}
    >
      <Terrain keepDry={KEEP_DRY} />
      <Paths nodes={NODES} edges={EDGES} walkers={0} />
      <GameManager />
      <Gate position={[0, 13 * G]} />
      {/* anchor = tailNode − dir·REACH; dir points HEAD -> TAIL */}
      <Teacups
        position={[PAD_X, ROWS[0]]}
        rotation={-Math.PI / 2}
        register={{ name: 'R1 Teacups', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
        queue={{ anchor: [TAIL_X + REACH, ROWS[0]], dir: [-1, 0] }}
      />
      <Carousel
        position={[-PAD_X, ROWS[0]]}
        rotation={Math.PI / 2}
        register={{ name: 'R2 Carousel', capacity: 4, rideDuration: 8, intensity: 2, price: 3 }}
        queue={{ anchor: [-TAIL_X - REACH, ROWS[0]], dir: [1, 0] }}
      />
      <TwistRide
        position={[PAD_X, ROWS[1]]}
        rotation={-Math.PI / 2}
        register={{ name: 'R3 Twist', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
        queue={{ anchor: [TAIL_X + REACH, ROWS[1]], dir: [-1, 0] }}
      />
      <SwingRide
        position={[-PAD_X, ROWS[1]]}
        rotation={Math.PI / 2}
        register={{ name: 'R4 Swings', capacity: 4, rideDuration: 8, intensity: 4, price: 3 }}
        queue={{ anchor: [-TAIL_X - REACH, ROWS[1]], dir: [1, 0] }}
      />
      <FerrisWheel
        position={[PAD_X, ROWS[2]]}
        rotation={-Math.PI / 2}
        register={{ name: 'R5 Wheel', capacity: 4, rideDuration: 8, intensity: 3, price: 3 }}
        queue={{ anchor: [TAIL_X + REACH, ROWS[2]], dir: [-1, 0] }}
      />
      <BumperCars
        position={[-PAD_X, ROWS[2]]}
        rotation={Math.PI / 2}
        register={{ name: 'R6 Bumpers', capacity: 4, rideDuration: 8, intensity: 4, price: 3 }}
        queue={{ anchor: [-TAIL_X - REACH, ROWS[2]], dir: [1, 0] }}
      />
      <LaneProbe />
      <LaneShots />
    </Park>
  );
}

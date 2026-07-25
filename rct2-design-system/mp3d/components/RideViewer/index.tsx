import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { UIWindow, UIWindowCorner, ViewportFrame, UI_TEXT } from '../UIWindow';
import { UIIcon, UIIconName } from '../UIIcons';
import { rect43, StageApi, StageViewportRect } from '../Stage';

// ---------------------------------------------------------------------------
// RideViewer — the RCT2 Ride window on UIWindow chrome: the colour-coded
// status line (Ride::formatStatusTo, src/openrct2/ride/Ride.cpp:528-564 —
// "Broken down" :534-537, "Closed" :549, "Open" fallthrough; broken/crashed
// draw red-outlined per openrct2-ui/windows/Ride.cpp:2537-2540) with a pixel
// status icon (ride / wrench / warning), the queue line ("N people queuing",
// GetStatusStation openrct2-ui/windows/Ride.cpp:2622-2634), riders/capacity
// and total customers — plus the RCT2 viewport tab reborn as a LIVE CAMERA
// INSET: a THREE camera rendered bottom-left through api.addViewport at the
// standard 4:3 pixel aspect (rect43) inside a mandatory ViewportFrame
// (rules/ui.md). A "View ride" button toggles the inset between the slow
// orbit of the ride's boardPoint and an onboard chase cam of the optional
// `vehicle` object. Deterministic; polls the ride handle.
// ---------------------------------------------------------------------------

export type RideViewerStatus = 'open' | 'closed' | 'brokenDown' | 'beingRepaired';

/** structural view of a GameManager registerRide handle (incl. the additive
 *  status()/totalRides()/boardPoint() accessors) */
export interface RideViewerRide {
  name: string;
  status(): RideViewerStatus;
  queueLength(): number;
  occupancy(): { riders: number; capacity: number; occupied?: boolean };
  /** the vehicle/seat anchor the inset camera orbits */
  boardPoint(): [number, number, number];
  /** riders served over the ride's lifetime */
  totalRides?(): number;
  /** ADDITIVE (data wiring only — the window body is UNCHANGED): the ride's
   *  measured RCT2 rating triple, when the registration carried one
   *  (`registerRide({ ratings })`, from SplineRideKit's `rateCoaster`). This is
   *  the data the real RCT2 ride window's Excitement / Intensity / Nausea lines
   *  read (openrct2-ui/windows/Ride.cpp:5936-5954, rating word via
   *  GetRatingName :5628-5632). Null for rides nobody measured. */
  ratings?(): { excitement: number; intensity: number; nausea: number; ratingBand?: string; nauseaExtreme?: boolean } | null;
}

export interface RideViewerProps {
  ride: RideViewerRide;
  /** Stage build API (third build arg) — supplies scene + addViewport */
  api: StageApi;
  /** window placement: a UIWindow corner or explicit px position
   *  (default top-left at 10,10 — NEVER top-right, rules/ui.md) */
  anchor?: UIWindowCorner | { x: number; y: number };
  onClose?: () => void;
  /** normalized inset rect — default bottom-left at 4:3 pixel aspect (rules/ui.md) */
  rect?: StageViewportRect;
  /** the ride's vehicle object — enables the "View ride" onboard chase cam */
  vehicle?: THREE.Object3D;
}

// RCT2 status line text + colour coding (formatStatusTo string set;
// red-outline treatment for broken states per Ride.cpp:2537-2540), plus the
// pixel status icon: ride pictogram when running/closed, wrench while the
// mechanic works, warning triangle when broken down.
const STATUS: Record<RideViewerStatus, { text: string; color: string; icon: UIIconName }> = {
  open: { text: 'Open', color: '#1E7A28', icon: 'ride' },
  closed: { text: 'Closed', color: '#5A5A52', icon: 'ride' },
  brokenDown: { text: 'Broken down', color: '#B01818', icon: 'warning' },
  beingRepaired: { text: 'Being repaired', color: '#B07818', icon: 'wrench' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '1px 0' }}>
      <span style={UI_TEXT.name}>{label}</span>
      <span style={UI_TEXT.value}>{value}</span>
    </div>
  );
}

export function RideViewer({ ride, api, anchor, onClose, rect, vehicle }: RideViewerProps) {
  const [, setTick] = useState(0);
  // rides with a vehicle open ON the follow cam (every ride ships one — the
  // orbit is the toggle); vehicle-less handles fall back to the orbit
  const [onboard, setOnboard] = useState(!!vehicle);
  const onboardRef = useRef(onboard);
  onboardRef.current = onboard;
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;

  // inset rect: honour the prop, else the standard bottom-left 4:3 slot
  const [vpRect] = useState<StageViewportRect>(() => {
    if (rect) return rect;
    const el = api.renderer.domElement;
    const aspect = (el.clientWidth || el.width) / (el.clientHeight || el.height) || 2.5;
    const r = rect43(0.02, 0, 0.24, aspect);
    return { ...r, y: 1 - 0.03 - r.h };
  });

  // poll the ride handle — the window body re-renders 4×/s
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // live camera inset: slow deterministic orbit of the boardPoint, or (View
  // ride) a FOLLOW cam glued behind the ride vehicle. In follow mode the
  // vehicle root goes on the viewport's hide-list so the car body never
  // blocks its own camera; seated sim guests are separate manager objects,
  // so the cam sits high (+1.15) and aims well past the seat line (+2.4
  // ahead at +0.25) to look OVER their heads rather than through them.
  useEffect(() => {
    const cam = new THREE.PerspectiveCamera(50, vpRect.w / vpRect.h, 0.1, 100);
    api.scene.add(cam);
    const veh0 = vehicleRef.current;
    const remove = api.addViewport(cam, vpRect, onboard && veh0 ? { hide: [veh0] } : undefined);
    const vp = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const fwd = new THREE.Vector3();
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      const veh = vehicleRef.current;
      if (onboardRef.current && veh) {
        // follow: behind and above the vehicle, looking down its travel line
        veh.getWorldPosition(vp);
        veh.getWorldQuaternion(q);
        fwd.set(0, 0, 1).applyQuaternion(q);
        cam.position.set(vp.x - fwd.x * 1.9, vp.y + 1.15, vp.z - fwd.z * 1.9);
        cam.lookAt(vp.x + fwd.x * 2.4, vp.y + 0.25, vp.z + fwd.z * 2.4);
      } else {
        const [bx, by, bz] = ride.boardPoint();
        const a = t * 0.35; // slow orbit
        cam.position.set(bx + Math.sin(a) * 2.6, by + 1.5, bz + Math.cos(a) * 2.6);
        cam.lookAt(bx, by + 0.25, bz);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      remove();
      api.scene.remove(cam);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ride, onboard]);

  const st = STATUS[ride.status()];
  const occ = ride.occupancy();
  const q = ride.queueLength();
  const pos = anchor && typeof anchor === 'object' ? anchor : { x: 10, y: 10 };
  const corner = typeof anchor === 'string' ? anchor : undefined;

  return (
    <>
      <UIWindow title={ride.name} x={pos.x} y={pos.y} corner={corner} width={210} onClose={onClose}>
        {/* status line — pixel icon + colour-coded RCT2 string */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <UIIcon name={st.icon} size={14} />
          <span style={{ fontWeight: 700, color: st.color }}>{st.text}</span>
        </div>
        <div style={{ ...UI_TEXT.header, marginTop: 2 }}>Station</div>
        <Row label="Queue" value={q === 0 ? 'empty' : q === 1 ? '1 person' : `${q} people`} />
        <Row label="Riders" value={`${occ.riders} / ${occ.capacity}`} />
        {ride.totalRides && <Row label="Customers" value={ride.totalRides()} />}
        <div style={{ ...UI_TEXT.header, marginTop: 5 }}>Camera</div>
        {vehicle && (
          <button
            onClick={() => setOnboard((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              margin: '3px 0 2px',
              padding: '3px 6px',
              cursor: 'pointer',
              background: onboard ? '#ABA294' : '#C0B8A8',
              borderStyle: 'solid',
              borderWidth: 1,
              borderTopColor: onboard ? '#6B6456' : '#E8E0D0',
              borderLeftColor: onboard ? '#6B6456' : '#E8E0D0',
              borderBottomColor: onboard ? '#E8E0D0' : '#6B6456',
              borderRightColor: onboard ? '#E8E0D0' : '#6B6456',
              outline: '1px solid #3A3226',
              borderRadius: 0,
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: 700,
              color: '#2E2820',
            }}
          >
            <UIIcon name="camera" size={13} />
            {onboard ? 'Orbit view' : 'View ride'}
          </button>
        )}
      </UIWindow>
      {/* mandatory framed-monitor chrome over the camera inset (rules/ui.md) */}
      <ViewportFrame rect={vpRect} />
    </>
  );
}

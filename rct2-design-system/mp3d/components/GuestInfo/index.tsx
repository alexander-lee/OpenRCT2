import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { UIWindow, ViewportFrame, UI_TEXT } from '../UIWindow';
import { UIIcon, UIIconName } from '../UIIcons';
import { rect43 } from '../Stage';
import type { StageApi, StageViewportRect } from '../Stage';

// ---------------------------------------------------------------------------
// GuestInfo — the RCT2 Guest window's STATS + THOUGHTS tabs on UIWindow
// chrome. Six bevelled stat bars mirror the stats-tab progress bars
// (openrct2-ui/windows/Guest.cpp:146-159: happiness/energy green, hunger/
// thirst/nausea/toilet red-warning bars) with RCT2's inversion — the hunger
// and thirst bars grow as the NEED grows, i.e. when the stored value is low
// (Guest.cpp:1125-1129 "the bar should be longer when peep->hunger is low").
// Below them, the thoughts list: the guest's 5-slot thought ring
// (kPeepMaxThoughts — thoughts tab, Guest.cpp:172,827-848), latest first,
// quoted. The mood line derives from happiness in RCT2 tone and leads with a
// LARGE pixel emotion face (emotionOf: one UIIcons face per moodOf band,
// nausea/sickness overriding to the green face). Pure DOM/CSS.
// ---------------------------------------------------------------------------

/** one record from GameManager.guests() */
export interface GuestInfoRecord {
  id: number;
  name: string;
  state: string;
  happiness: number; // all needs 0..255 (RCT2 ranges)
  hunger: number;
  thirst: number;
  energy: number;
  nausea: number;
  toilet: number;
  thoughts: string[];
  position?: [number, number, number];
}

export interface GuestInfoProps {
  guest: GuestInfoRecord;
  onClose?: () => void;
  /** explicit px position (default 10,10 — never the top-right slot) */
  x?: number;
  y?: number;
  /** Stage build API — with `object`, enables the guest PLAYER CAMERA inset:
   *  a live over-the-shoulder follow cam of this guest in the standard
   *  bottom-left 4:3 slot, with a first-person toggle in the window */
  api?: StageApi;
  /** the clicked guest's scene group (the `userData.guestRef` carrier) */
  object?: THREE.Object3D;
  /** inset rect override (default: bottom-left 4:3 slot, rules/ui.md) */
  rect?: StageViewportRect;
}

// mood from happiness — RCT2 tone (happy guests bounce, sub-96 guests trudge)
export function moodOf(happiness: number): string {
  if (happiness >= 200) return 'Very happy';
  if (happiness >= 160) return 'Happy';
  if (happiness >= 96) return 'Fine';
  if (happiness >= 64) return 'Unhappy';
  return 'Angry';
}

/**
 * Emotion face for a guest record — one pixel face per moodOf band
 * (ecstatic / happy / neutral / unhappy / angry), with SICKNESS overriding:
 * nausea ≥ 180 or a sick-ish state turns the face green regardless of mood.
 */
export function emotionOf(g: Pick<GuestInfoRecord, 'happiness' | 'nausea' | 'state'>): UIIconName {
  if (g.nausea >= 180 || /sick|vomit|nause/i.test(g.state)) return 'faceSick';
  if (g.happiness >= 200) return 'faceEcstatic';
  if (g.happiness >= 160) return 'faceHappy';
  if (g.happiness >= 96) return 'faceNeutral';
  if (g.happiness >= 64) return 'faceUnhappy';
  return 'faceAngry';
}

// bar chrome: sunk bevel like the UIWindow inset panel
const BAR_LIGHT = '#E8E0D0';
const BAR_SHADOW = '#6B6456';
const BAR_BG = '#9C9480';

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / 255) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
      <div style={{ width: 62, flex: 'none', ...UI_TEXT.name, fontSize: 10 }}>{label}</div>
      <div
        style={{
          flex: 1,
          height: 10,
          background: BAR_BG,
          borderStyle: 'solid',
          borderWidth: 1,
          borderTopColor: BAR_SHADOW,
          borderLeftColor: BAR_SHADOW,
          borderBottomColor: BAR_LIGHT,
          borderRightColor: BAR_LIGHT,
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

export function GuestInfo({ guest, onClose, x = 10, y = 10, api, object, rect }: GuestInfoProps) {
  const g = guest;
  const [firstPerson, setFirstPerson] = useState(false);
  const objRef = useRef(object);
  objRef.current = object;

  // guest player camera: standard bottom-left 4:3 inset slot (rules/ui.md)
  const [vpRect] = useState<StageViewportRect | null>(() => {
    if (!api || !object) return null;
    if (rect) return rect;
    const el = api.renderer.domElement;
    const aspect = (el.clientWidth || el.width) / (el.clientHeight || el.height) || 2.5;
    const r = rect43(0.02, 0, 0.24, aspect);
    return { ...r, y: 1 - 0.03 - r.h };
  });
  useEffect(() => {
    if (!api || !object || !vpRect) return;
    const cam = new THREE.PerspectiveCamera(58, vpRect.w / vpRect.h, 0.05, 120);
    api.scene.add(cam);
    // first person hides the guest for its own pass — see the park, not the
    // inside of their head; the follow cam keeps them in frame
    const remove = api.addViewport(cam, vpRect, firstPerson ? { hide: [object] } : undefined);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const fwd = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      const o = objRef.current;
      if (o) {
        o.getWorldPosition(p);
        o.getWorldQuaternion(q);
        fwd.set(0, 0, 1).applyQuaternion(q); // peeps walk local +z
        if (firstPerson) {
          cam.position.set(p.x + fwd.x * 0.08, p.y + 0.78, p.z + fwd.z * 0.08); // eye height
          cam.lookAt(p.x + fwd.x * 3, p.y + 0.5, p.z + fwd.z * 3);
        } else {
          cam.position.set(p.x - fwd.x * 1.5, p.y + 1.05, p.z - fwd.z * 1.5); // over the shoulder
          cam.lookAt(p.x + fwd.x * 1.6, p.y + 0.45, p.z + fwd.z * 1.6);
        }
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
  }, [api, object, vpRect, firstPerson]);

  // happiness bar sweeps green -> red as it empties (hue 120 -> 0)
  const happyColor = `hsl(${Math.round((g.happiness / 255) * 120)}, 62%, 36%)`;
  return (
    <>
    <UIWindow title={g.name} x={x} y={y} width={224} onClose={onClose}>
      {/* mood line: the guest's EMOTION as a large pixel face — one of the six
          14x14 faces (ecstatic → angry per happiness band; green when sick) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <UIIcon name={emotionOf(g)} size={30} />
        <span style={UI_TEXT.name}>{moodOf(g.happiness)}</span>
        <span style={{ ...UI_TEXT.value, marginLeft: 'auto' }}>{g.state}</span>
      </div>
      <div style={{ ...UI_TEXT.header, marginBottom: 3 }}>Stats</div>
      {/* stats tab bars (Guest.cpp:146-159); hunger/thirst inverted (:1125-1129) */}
      <StatBar label="Happiness" value={g.happiness} color={happyColor} />
      <StatBar label="Energy" value={g.energy} color="#C8A818" />
      <StatBar label="Hunger" value={255 - g.hunger} color="#B05818" />
      <StatBar label="Thirst" value={255 - g.thirst} color="#2860A8" />
      <StatBar label="Nausea" value={g.nausea} color="#5A8828" />
      <StatBar label="Toilet" value={g.toilet} color="#7A5228" />
      {/* thoughts tab: the 5-slot ring, latest first (Guest.cpp:827-848) */}
      <div style={{ marginTop: 5, borderTop: `1px solid ${BAR_SHADOW}`, paddingTop: 4 }}>
        <div style={{ ...UI_TEXT.header, marginBottom: 2 }}>Thoughts</div>
        {g.thoughts.length === 0 && <div style={{ ...UI_TEXT.value, opacity: 0.8 }}>(no recent thoughts)</div>}
        {g.thoughts.slice(0, 5).map((th, i) => (
          <div key={`${i}-${th}`} style={{ ...UI_TEXT.value, opacity: 1 - i * 0.13 }}>
            &ldquo;{th}&rdquo;
          </div>
        ))}
      </div>
      {/* guest player camera (only when the Stage api + scene object exist) */}
      {vpRect && (
        <div style={{ marginTop: 5, borderTop: `1px solid ${BAR_SHADOW}`, paddingTop: 4 }}>
          <div style={{ ...UI_TEXT.header, marginBottom: 2 }}>Camera</div>
          <button
            onClick={() => setFirstPerson((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              width: '100%',
              margin: '3px 0 2px',
              padding: '3px 6px',
              cursor: 'pointer',
              background: firstPerson ? '#ABA294' : '#C0B8A8',
              borderStyle: 'solid',
              borderWidth: 1,
              borderTopColor: firstPerson ? '#6B6456' : '#E8E0D0',
              borderLeftColor: firstPerson ? '#6B6456' : '#E8E0D0',
              borderBottomColor: firstPerson ? '#E8E0D0' : '#6B6456',
              borderRightColor: firstPerson ? '#E8E0D0' : '#6B6456',
              outline: '1px solid #3A3226',
              borderRadius: 0,
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: 700,
              color: '#2E2820',
            }}
          >
            <UIIcon name="camera" size={13} />
            {firstPerson ? 'Follow view' : 'Walk with guest'}
          </button>
        </div>
      )}
    </UIWindow>
    {/* mandatory framed-monitor chrome over the camera inset (rules/ui.md) */}
    {vpRect && <ViewportFrame rect={vpRect} />}
    </>
  );
}

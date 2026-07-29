import React, { useEffect, useState } from 'react';
import { UIWindow, UI_TEXT } from '../UIWindow';
import { UIIcon } from '../UIIcons';
import { GuestThoughts } from '../GuestThoughts';
import type { GuestThoughtsGuest } from '../GuestThoughts';
import type { StageApi } from '../Stage';

// ---------------------------------------------------------------------------
// ParkInfo — the park-wide ride roster on UIWindow chrome, anchored
// bottom-right and collapsible (both MANDATORY — rules/ui.md "Park Info
// window anchors corner=bottom-right and MUST be collapsible"). Every
// registered ride gets a row: a status dot colour-coded like the RCT2 ride
// status line (Ride::formatStatusTo, src/openrct2/ride/Ride.cpp:528-564 —
// green open / grey closed / red broken down / amber being repaired), the
// name and the queue count. Clicking a row TELEPORTS the main orbit camera
// via api.setCameraPose to a vantage offset from the ride's boardPoint.
// ---------------------------------------------------------------------------

export type ParkInfoStatus = 'open' | 'closed' | 'brokenDown' | 'beingRepaired';

export interface ParkInfoRideRow {
  name: string;
  status: ParkInfoStatus;
  queue: number;
  boardPoint: [number, number, number];
}

/** structural view of a GameManager — rides() is the additive roster accessor */
export interface ParkInfoManager {
  rides(): ParkInfoRideRow[];
  stats?(): { activeGuests: number; avgHappiness: number };
  /** live guest records — enables the "Guest thoughts" summarised window */
  guests?(): GuestThoughtsGuest[];
}

export interface ParkInfoProps {
  manager: ParkInfoManager;
  /** Stage build API (third build arg) — supplies setCameraPose */
  api: StageApi;
  width?: number;
}

const DOT: Record<ParkInfoStatus, string> = {
  open: '#1E7A28', // green
  closed: '#5A5A52', // grey
  brokenDown: '#B01818', // red
  beingRepaired: '#B07818', // amber
};

export function ParkInfo({ manager, api, width = 216 }: ParkInfoProps) {
  const [, setTick] = useState(0);
  // the "Guest thoughts" window (RCT2 Guest List summarised-thoughts view)
  // is LAUNCHED from here — ParkInfo owns the manager (rules/ui.md placement:
  // it opens free-positioned, clear of the top-left slot and the switcher)
  const [thoughtsOpen, setThoughtsOpen] = useState(false);

  // poll the roster ~3×/s — status dots and queue counts stay live
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  const rows = manager.rides();
  const stats = manager.stats?.();

  const teleport = (r: ParkInfoRideRow) => {
    const [bx, by, bz] = r.boardPoint;
    // vantage: up-and-back diagonal from the boardPoint, aimed at the ride
    api.setCameraPose?.([bx + 3.4, by + 2.6, bz + 3.4], [bx, by + 0.4, bz]);
  };

  return (
    <>
      {/* SCROLL THE ROSTER. This list is unbounded — it grows with every
          registered ride, and a five-land park runs 13+ — while the body was
          `overflow: hidden`, so the tail was silently CLIPPED and the window
          walked off the bottom of the canvas (anchored bottom-right, it grows
          UPWARD into the view). 260 px shows ~11 rows plus the stats block
          before it scrolls, so a small park's window is the height it always
          was.
          WARNING, twice-burned: a slash-slash comment placed inside a JSX
          fragment is TEXT, and renders as visible characters in the window —
          and it bundles clean, so no gate catches it. Use a braced JSX comment
          here, and do NOT write a nested comment terminator inside it, because
          the first one ends the comment early and dumps the rest on screen. */}
    <UIWindow title="Park Information" corner="bottom-right" width={width} collapsible maxBodyHeight={260}>
      {stats && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <UIIcon name="guest" size={12} />
          <span style={UI_TEXT.name}>{stats.activeGuests}</span>
          <span style={{ ...UI_TEXT.value, marginRight: 6 }}>guests</span>
          <UIIcon name={stats.avgHappiness >= 96 ? 'happy' : 'sad'} size={12} />
          <span style={UI_TEXT.name}>{Math.round(stats.avgHappiness)}</span>
          <span style={UI_TEXT.value}>happiness</span>
        </div>
      )}
      <div style={{ ...UI_TEXT.header, marginBottom: 2 }}>Rides</div>
      {rows.length === 0 && <div style={{ ...UI_TEXT.value, opacity: 0.8 }}>(no rides registered)</div>}
      {rows.map((r) => (
        <div
          key={r.name}
          onClick={() => teleport(r)}
          title={`View ${r.name}`}
          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '1px 0' }}
        >
          <UIIcon name="ride" size={12} />
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: DOT[r.status],
              outline: '1px solid #3A3226',
              flex: 'none',
            }}
          />
          <span
            style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...UI_TEXT.name }}
          >
            {r.name}
          </span>
          <span style={{ flex: 'none', ...UI_TEXT.value }}>Q:{r.queue}</span>
        </div>
      ))}
      <div style={{ ...UI_TEXT.value, fontSize: 9, marginTop: 3, opacity: 0.85 }}>Click a ride to view it</div>
      {manager.guests && (
        <button
          onClick={() => setThoughtsOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            width: '100%',
            margin: '4px 0 1px',
            padding: '3px 6px',
            cursor: 'pointer',
            background: thoughtsOpen ? '#ABA294' : '#C0B8A8',
            borderStyle: 'solid',
            borderWidth: 1,
            borderTopColor: thoughtsOpen ? '#6B6456' : '#E8E0D0',
            borderLeftColor: thoughtsOpen ? '#6B6456' : '#E8E0D0',
            borderBottomColor: thoughtsOpen ? '#E8E0D0' : '#6B6456',
            borderRightColor: thoughtsOpen ? '#E8E0D0' : '#6B6456',
            outline: '1px solid #3A3226',
            borderRadius: 0,
            fontFamily: 'inherit',
            fontSize: 10,
            fontWeight: 700,
            color: '#2E2820',
          }}
        >
          <UIIcon name="guest" size={13} />
          Guest thoughts
        </button>
      )}
    </UIWindow>
    {thoughtsOpen && manager.guests && (
      <GuestThoughts manager={manager as { guests(): GuestThoughtsGuest[] }} onClose={() => setThoughtsOpen(false)} />
    )}
    </>
  );
}

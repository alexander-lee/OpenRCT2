import React, { useEffect, useState } from 'react';
import { UIWindow, UI_TEXT } from '../UIWindow';
import { UIIcon, UIIconName } from '../UIIcons';
import { emotionOf } from '../GuestInfo';

// ---------------------------------------------------------------------------
// GuestThoughts — the RCT2 Guest List window's SUMMARISED THOUGHTS view on
// UIWindow chrome (openrct2-ui/windows/GuestList.cpp: RefreshGroups groups
// every in-park guest by their FRESHEST thought via GetArgumentsFromPeep
// (:875-885 reads peep.thoughts[0]), draws a strip of small guest faces per
// group (DrawScrollSummarised :718-765) with the thought text and a
// right-aligned "N guests" count, and sorts the groups most-guests-first
// (:860-862)). Here: manager.guests() is POLLED every 500 ms (never per
// frame — rules/ui.md), each active guest's latest thought is tallied, and
// every distinct thought gets a row — up to four overlapping pixel emotion
// faces (UIIcons, no emoji), the quoted text, and the guest count. Pure
// DOM/CSS, deterministic.
// ---------------------------------------------------------------------------

/** structural slice of one GameManager.guests() record */
export interface GuestThoughtsGuest {
  id: number;
  happiness: number;
  nausea: number;
  state: string;
  thoughts: string[];
  gone?: boolean;
}

/** structural view of a GameManager — guests() is the live-records accessor */
export interface GuestThoughtsManager {
  guests(): GuestThoughtsGuest[];
}

export interface GuestThoughtsProps {
  manager: GuestThoughtsManager;
  onClose?: () => void;
  /** explicit px position — default (244, 10): clear of the top-left
   *  RideViewer/GuestInfo slot AND of the top-right switcher (rules/ui.md) */
  x?: number;
  y?: number;
  width?: number;
  /** max summarised rows shown (GuestList.cpp caps groups too, kMaxGroups) */
  maxRows?: number;
}

interface ThoughtGroup {
  text: string;
  count: number;
  faces: UIIconName[]; // up to kFaces emotion faces, in tally order
}

const K_FACES = 4; // faces drawn per row (RCT2 draws a strip of small faces)

/**
 * RCT2 grouping (GuestList.cpp RefreshGroups): each guest contributes their
 * FRESHEST thought only; guests with no thoughts join no group; groups sort
 * by guest count (desc), text as the deterministic tiebreak.
 */
export function summariseThoughts(guests: GuestThoughtsGuest[], maxRows: number): ThoughtGroup[] {
  const groups = new Map<string, ThoughtGroup>();
  for (const g of guests) {
    if (g.gone) continue;
    const text = g.thoughts[0];
    if (!text) continue;
    let grp = groups.get(text);
    if (!grp) {
      grp = { text, count: 0, faces: [] };
      groups.set(text, grp);
    }
    grp.count += 1;
    if (grp.faces.length < K_FACES) grp.faces.push(emotionOf(g));
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1))
    .slice(0, maxRows);
}

export function GuestThoughts({ manager, onClose, x = 244, y = 10, width = 232, maxRows = 10 }: GuestThoughtsProps) {
  const [, setTick] = useState(0);

  // poll the guest records every 500 ms — summarising is cheap, per-frame
  // reads are banned (rules/ui.md "Poll, never per-frame")
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const active = manager.guests().filter((g) => !g.gone);
  const groups = summariseThoughts(active, maxRows);

  return (
    <UIWindow title="Guest Thoughts" x={x} y={y} width={width} onClose={onClose}>
      <div style={{ ...UI_TEXT.header, marginBottom: 3 }}>Summarised guest thoughts</div>
      {groups.length === 0 && (
        <div style={{ ...UI_TEXT.value, opacity: 0.8 }}>(no guests are thinking anything)</div>
      )}
      {groups.map((grp) => (
        <div
          key={grp.text}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 0',
            borderBottom: '1px solid #A29A88',
          }}
        >
          {/* the RCT2 face strip: one small pixel face per counted guest, capped */}
          <span style={{ display: 'flex', flex: 'none' }}>
            {grp.faces.map((f, i) => (
              <span key={i} style={{ marginLeft: i === 0 ? 0 : -5, display: 'inline-flex' }}>
                <UIIcon name={f} size={14} />
              </span>
            ))}
          </span>
          <span style={{ flex: 1, ...UI_TEXT.value, lineHeight: 1.3 }}>&ldquo;{grp.text}&rdquo;</span>
          <span style={{ flex: 'none', ...UI_TEXT.name, fontSize: 10 }}>
            {grp.count} {grp.count === 1 ? 'guest' : 'guests'}
          </span>
        </div>
      ))}
      <div style={{ ...UI_TEXT.value, fontSize: 9, marginTop: 3, opacity: 0.85 }}>
        {active.length} {active.length === 1 ? 'guest' : 'guests'} in the park
      </div>
    </UIWindow>
  );
}

import React, { useRef, useState } from 'react';
import { UIIcon } from '../UIIcons';

// ---------------------------------------------------------------------------
// UIWindow — the classic RCT2 window chrome, reproduced in pure DOM/CSS (no
// images): tan bevelled frame, dark brownish-red title bar with centred text,
// square bevelled close / collapse buttons, and a darker inset content panel.
// Draggable from ANY point (except interactive elements — buttons, links,
// inputs, [data-nodrag]), anchorable to a corner, collapsible to the bar.
// This is the BASE chrome every window in the system consumes (ride viewer,
// guest info, park info, ...) — see rules/ui.md for placement rules.
// ---------------------------------------------------------------------------

export type UIWindowCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface UIWindowProps {
  /** centred text in the title bar */
  title: string;
  children?: React.ReactNode;
  /** explicit position (px from the container's top-left); ignored when `corner` is set */
  x?: number;
  y?: number;
  /** window width in px */
  width?: number;
  /** when provided, renders the square X button and calls this on click */
  onClose?: () => void;
  /** show the collapse chevron; collapsed windows shrink to the title bar */
  collapsible?: boolean;
  /** anchor to a container corner (10px inset) instead of x/y */
  corner?: UIWindowCorner;
  /**
   * Cap the BODY's height in px and scroll it when the content is taller.
   *
   * Without this the body is `overflow: hidden` inside a fixed-width frame, so
   * a list that outgrows it is simply CLIPPED — a park with more rides than fit
   * silently loses the tail of its ride list, and a tall window otherwise walks
   * off the bottom of the canvas. RCT2's own windows scroll their lists, and
   * `ParkInfo` / `GuestThoughts` are exactly the lists that grow without bound.
   *
   * The scrollbar is styled to the window chrome (WebKit + Firefox), because a
   * default OS scrollbar inside a hand-drawn RCT2 frame reads as a browser
   * artifact sitting on top of the game.
   */
  maxBodyHeight?: number;
}

// RCT2 chrome palette
const BODY = '#BDB4A4';
const FACE = '#C0B8A8';
const LIGHT = '#E8E0D0';
const SHADOW = '#6B6456';
const OUTLINE = '#3A3226';
const INSET = '#B0A890';
const TITLE_BG = '#8C3428';
const TITLE_HI = '#A84A38';
const TITLE_LO = '#5C2018';
const TITLE_TEXT = '#F0E8D0';

const INSET_PX = 10;

/**
 * Shared window-content typography (rules/ui.md): list-item NAMES bold,
 * secondary values normal weight + slightly smaller + muted, section headers
 * small-caps and letter-spaced. Spread into inline styles.
 */
export const UI_TEXT: {
  name: React.CSSProperties;
  value: React.CSSProperties;
  header: React.CSSProperties;
} = {
  name: { fontWeight: 700, color: '#2E2820' },
  value: { fontWeight: 400, fontSize: 10, color: '#4E4638' },
  header: {
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#5A5244',
  },
};

function bevel(sunk: boolean, px = 2): React.CSSProperties {
  return {
    borderStyle: 'solid',
    borderWidth: px,
    borderTopColor: sunk ? SHADOW : LIGHT,
    borderLeftColor: sunk ? SHADOW : LIGHT,
    borderBottomColor: sunk ? LIGHT : SHADOW,
    borderRightColor: sunk ? LIGHT : SHADOW,
  };
}

function TitleButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => {
        e.stopPropagation(); // don't start a window drag
        setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={label}
      aria-label={label}
      style={{
        width: 15,
        height: 15,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: FACE,
        outline: `1px solid ${OUTLINE}`,
        borderRadius: 0,
        flex: 'none',
        ...bevel(pressed, 1),
      }}
    >
      {children}
    </button>
  );
}

export function UIWindow({
  title,
  children,
  x = 10,
  y = 10,
  width = 224,
  onClose,
  collapsible = false,
  maxBodyHeight,
  corner,
}: UIWindowProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const drag = useRef<{ startX: number; startY: number; baseDx: number; baseDy: number } | null>(null);

  // drag from ANY point of the window (RCT2 windows drag by the body too) —
  // EXCEPT interactive elements: buttons, links, inputs, or anything inside
  // a [data-nodrag] wrapper keep their normal pointer behaviour.
  const onWinDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest?.('button, a, input, select, textarea, [data-nodrag]')) return;
    drag.current = { startX: e.clientX, startY: e.clientY, baseDx: offset.dx, baseDy: offset.dy };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onWinMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ dx: d.baseDx + (e.clientX - d.startX), dy: d.baseDy + (e.clientY - d.startY) });
  };
  const onWinUp = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  // deterministic base position: corner anchor (10px inset) or explicit x/y
  const pos: React.CSSProperties = corner
    ? {
        top: corner.startsWith('top') ? INSET_PX : undefined,
        bottom: corner.startsWith('bottom') ? INSET_PX : undefined,
        left: corner.endsWith('left') ? INSET_PX : undefined,
        right: corner.endsWith('right') ? INSET_PX : undefined,
      }
    : { top: y, left: x };

  return (
    <div
      onPointerDown={onWinDown}
      onPointerMove={onWinMove}
      onPointerUp={onWinUp}
      style={{
        position: 'absolute',
        ...pos,
        width,
        zIndex: 4, // below the top-right UIDayNight (z 5)
        transform: offset.dx || offset.dy ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
        background: BODY,
        outline: `1px solid ${OUTLINE}`,
        boxShadow: '2px 3px 6px rgba(0,0,0,0.35)',
        fontFamily: 'Verdana, Geneva, sans-serif',
        userSelect: 'none',
        touchAction: 'none',
        ...bevel(false, 2),
      }}
    >
      {/* title bar */}
      <div
        style={{
          position: 'relative',
          height: 19,
          display: 'flex',
          alignItems: 'center',
          background: TITLE_BG,
          borderTop: `1px solid ${TITLE_HI}`,
          borderBottom: `1px solid ${TITLE_LO}`,
          cursor: 'move',
          touchAction: 'none',
          padding: '0 3px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: TITLE_TEXT,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: '17px',
            textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {title}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, position: 'relative' }}>
          {collapsible && (
            <TitleButton onClick={() => setCollapsed((c) => !c)} label={collapsed ? 'Expand' : 'Collapse'}>
              <UIIcon name={collapsed ? 'chevronDown' : 'chevronUp'} size={11} />
            </TitleButton>
          )}
          {onClose && (
            <TitleButton onClick={onClose} label="Close">
              <UIIcon name="close" size={11} />
            </TitleButton>
          )}
        </div>
      </div>
      {/* body: darker inset panel inside the tan frame */}
      {!collapsed && (
        <div style={{ padding: 4 }}>
          <div
            style={{
              background: INSET,
              padding: 6,
              color: '#2E2820',
              fontSize: 11,
              lineHeight: 1.45,
              ...bevel(true, 1),
              // SCROLL, don't clip. `overflow: hidden` is the default and is
              // right for a fixed panel, but a list that grows (rides, guest
              // thoughts) must be reachable. `overscrollBehavior: contain`
              // stops a wheel event at the list's end from scrolling the page
              // behind it; `WebkitOverflowScrolling` keeps momentum on touch.
              ...(maxBodyHeight === undefined
                ? null
                : {
                    maxHeight: maxBodyHeight,
                    overflowY: 'auto' as const,
                    overflowX: 'hidden' as const,
                    // the frame sets `touchAction: 'none'` for its drag; give
                    // vertical gestures back to the scroller
                    touchAction: 'pan-y' as const,
                    overscrollBehavior: 'contain' as const,
                    WebkitOverflowScrolling: 'touch' as const,
                    // Firefox: colour the native bar to the chrome
                    scrollbarWidth: 'thin' as const,
                    scrollbarColor: `${SHADOW} ${INSET}`,
                  }),
            }}
            // the wheel must not fall through to the Stage's zoom handler while
            // the pointer is over a scrollable list
            onWheel={maxBodyHeight === undefined ? undefined : (e) => e.stopPropagation()}
            // A SCROLLABLE BODY MUST OPT OUT OF THE WINDOW DRAG, or the feature
            // is cosmetic: this window drags from ANY point (RCT2 windows drag
            // by their body), `onWinDown` only exempts
            // `button, a, input, select, textarea, [data-nodrag]`, and the frame
            // sets `touchAction: 'none'`. Without both of these a drag inside
            // the list moves the WINDOW instead of scrolling it, and touch
            // scrolling is dead entirely. `pan-y` keeps horizontal drags (and
            // therefore the window drag) working while giving vertical ones to
            // the scroller.
            {...(maxBodyHeight === undefined ? null : { 'data-nodrag': true })}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ViewportFrame — the mandatory chrome for every `api.addViewport` camera
 * inset (rules/ui.md): a UIWindow-bevel border overlay positioned over the
 * viewport's normalized rect so the raw camera view reads as a framed RCT2
 * viewport widget (tan bevelled frame outside, dark inner edge inside).
 * Render it as a sibling of the Stage inside the same `position: relative`
 * wrapper. Pointer-events pass through.
 */
export function ViewportFrame({ rect }: { rect: { x: number; y: number; w: number; h: number } }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: 3, // under windows (4) and the day/night switcher (5)
        // tan bevelled frame: raised outer edge like the window body...
        borderStyle: 'solid',
        borderWidth: 3,
        borderTopColor: LIGHT,
        borderLeftColor: LIGHT,
        borderBottomColor: SHADOW,
        borderRightColor: SHADOW,
        background: 'transparent',
        outline: `1px solid ${OUTLINE}`,
        // ...with the RCT2 viewport widget's dark sunken inner edge
        boxShadow: `inset 0 0 0 1px ${OUTLINE}, inset 1px 1px 0 1px rgba(0,0,0,0.35)`,
      }}
    />
  );
}

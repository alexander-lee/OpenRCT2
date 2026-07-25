import React, { useState } from 'react';
import { UIIcon } from '../UIIcons';

// ---------------------------------------------------------------------------
// UIDayNight — the day/night switcher for every Stage. Pixel-art icons only
// (UIIcon sun / moon, no text), RCT2-flavoured tan bevelled chrome, and it is
// ALWAYS and ONLY positioned top-right of the stage (see rules/ui.md). Stage
// renders one automatically — rigs never add their own.
//
// State reading (the fix for "night looks always selected"): the two states
// are now unmistakable — DAY is a raised light-tan button with a bright gold
// pixel sun; NIGHT latches pressed-in with a clearly darker navy face and a
// pale pixel moon. Previously both states shared near-identical tan faces and
// the sun's heavy dark outline read as a pressed/moon state.
// ---------------------------------------------------------------------------

export interface UIDayNightProps {
  /** true = night mode is active (button shows the moon, pressed-in look) */
  night: boolean;
  /** called on click — flip the night state in the owner */
  onToggle: () => void;
}

const LIGHT = '#E8E0D0';
const SHADOW = '#6B6456';
const FACE_DAY = '#D0C8B4'; // clearly light: raised day button
const FACE_NIGHT = '#4E5468'; // clearly dark: latched night button
const NIGHT_HI = '#2E3444'; // pressed bevel tones on the dark face
const NIGHT_LO = '#8890A8';

export function UIDayNight({ night, onToggle }: UIDayNightProps) {
  const [pressed, setPressed] = useState(false);
  const sunk = night || pressed; // night reads as latched "pressed in"
  // bevel: raised = light top/left; sunk = dark top/left (per face palette)
  const topLeft = sunk ? (night ? NIGHT_HI : SHADOW) : LIGHT;
  const bottomRight = sunk ? (night ? NIGHT_LO : LIGHT) : SHADOW;
  return (
    <button
      onClick={onToggle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={night ? 'Switch to day' : 'Switch to night'}
      aria-label={night ? 'Switch to day' : 'Switch to night'}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 5,
        width: 34,
        height: 34,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: night ? FACE_NIGHT : FACE_DAY,
        borderStyle: 'solid',
        borderWidth: 2,
        borderTopColor: topLeft,
        borderLeftColor: topLeft,
        borderBottomColor: bottomRight,
        borderRightColor: bottomRight,
        outline: '1px solid #3A3226',
        borderRadius: 0,
        boxShadow: night ? 'inset 1px 1px 3px rgba(0,0,0,0.45)' : '0 1px 4px rgba(0,0,0,0.35)',
        transform: sunk ? 'translate(1px, 1px)' : 'none',
      }}
    >
      <UIIcon name={night ? 'moon' : 'sun'} size={22} />
    </button>
  );
}

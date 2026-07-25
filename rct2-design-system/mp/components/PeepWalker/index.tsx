import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface PeepWalkerProps { name: string; group?: string; frames: Record<string, Cell[]>; fps?: number; zoom?: number; }
const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** Animated, direction-selectable RCT2 peep walk cycle (real sprites). */
export function PeepWalker({ name, group, frames, fps = 6, zoom = 6 }: PeepWalkerProps) {
  const dirKeys = Object.keys(frames);
  const [d, setD] = useState(dirKeys[0]);
  const [f, setF] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(zoom);
  const seq = frames[d] || [];
  useEffect(() => {
    if (!playing || seq.length < 2) return;
    const t = setInterval(() => setF((p) => (p + 1) % seq.length), 1000 / fps);
    return () => clearInterval(t);
  }, [playing, seq.length, fps, d]);
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      {group && <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg p-3" style={{ background: '#5c8a5c' }}>
        <AtlasCell cell={seq[f % Math.max(seq.length, 1)]} scale={scale} />
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {dirKeys.map((k, idx) => (
          <button key={k} onClick={() => setD(k)} className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === d ? '#2dd4bf' : '#334848', color: k === d ? '#04201d' : '#a7c4c4' }}>{DIRS[idx] || k}</button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸ walk' : '▶ walk'}</button>
      </div>
      <input type="range" min={3} max={12} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}

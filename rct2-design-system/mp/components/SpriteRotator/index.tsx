import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface SpriteRotatorProps { name: string; group?: string; cells: Cell[]; zoom?: number; background?: string; }
const DIRS = ['NE', 'SE', 'SW', 'NW'];

/** A real RCT2 asset shown across its 4 map rotations (auto-rotate + manual). */
export function SpriteRotator({ name, group, cells, zoom = 4, background = '#7a9a9a' }: SpriteRotatorProps) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(zoom);
  useEffect(() => {
    if (!playing || cells.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % cells.length), 640);
    return () => clearInterval(t);
  }, [playing, cells.length]);
  const [, , w, h] = cells[0];
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      {group && <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">{group}</div>}
      <div className="flex items-center justify-center rounded-lg p-3" style={{ background, minWidth: w * scale + 24, minHeight: h * scale + 24 }}>
        <AtlasCell cell={cells[i % cells.length]} scale={scale} />
      </div>
      <div className="text-sm font-semibold text-white">{name}</div>
      <div className="flex items-center gap-1">
        {cells.map((_, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }} className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: k === i ? '#2dd4bf' : '#334848', color: k === i ? '#04201d' : '#a7c4c4' }}>{DIRS[k] || k + 1}</button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-1 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸ rotating' : '▶ rotate'}</button>
      </div>
      <input type="range" min={2} max={9} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-32 accent-teal-400" />
    </div>
  );
}

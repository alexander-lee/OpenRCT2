import React, { useEffect, useState } from 'react';
import { AtlasCell, type Cell } from '../Atlas';

export interface FaceItem { name: string; cell: Cell; }
export interface MoodFacesProps { faces: FaceItem[]; zoom?: number; }

/** The real RCT2 guest mood faces (unhappy → very happy → tired/sick), cycling. */
export function MoodFaces({ faces, zoom = 2 }: MoodFacesProps) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((p) => (p + 1) % faces.length), 700);
    return () => clearInterval(t);
  }, [playing, faces.length]);
  const face = faces[i % faces.length];
  return (
    <div className="inline-flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: '#1b2828' }}>
      <div className="self-start text-[10px] font-bold uppercase tracking-widest text-teal-300/70">Peep · Guest · Mood</div>
      <div className="flex items-center justify-center rounded-lg p-4" style={{ background: '#f4e9c8' }}>
        <AtlasCell cell={face.cell} scale={zoom} />
      </div>
      <div className="text-sm font-semibold text-white">{face.name}</div>
      <div className="flex max-w-[260px] flex-wrap items-center justify-center gap-1">
        {faces.map((fc, k) => (
          <button key={k} onClick={() => { setI(k); setPlaying(false); }} className="h-2 w-2 rounded-full"
            style={{ background: k === i ? '#2dd4bf' : '#456' }} title={fc.name} />
        ))}
        <button onClick={() => setPlaying((p) => !p)} className="ml-2 rounded bg-teal-500 px-2 py-0.5 text-[11px] font-bold text-teal-950">{playing ? '⏸' : '▶'}</button>
      </div>
    </div>
  );
}

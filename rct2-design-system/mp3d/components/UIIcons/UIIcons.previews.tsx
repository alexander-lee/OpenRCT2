import React from 'react';
import { UIIcon, UI_ICON_NAMES } from './index';
import { UIWindow } from '../UIWindow';

const previews = {
  componentName: 'UIIcons',
  importPath: 'components/UIIcons',
  previews: [
    {
      name: 'Icon wall',
      description:
        'Every pixel-art icon in the set (hand-drawn 10x10 grids, 2-3 colours + dark outline, RCT2 toolbar-pictogram spirit) on UIWindow chrome, at 40, 20 and 10px.',
      render: () => (
        <div style={{ position: 'relative', width: '100%', height: 620, background: '#4a5a4a', borderRadius: 8 }}>
          <UIWindow title="Pixel Icons" x={16} y={16} width={420}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {UI_ICON_NAMES.map((n) => (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <UIIcon name={n} size={40} />
                  <UIIcon name={n} size={20} />
                  <UIIcon name={n} size={10} />
                  <div style={{ fontSize: 9, opacity: 0.8 }}>{n}</div>
                </div>
              ))}
            </div>
          </UIWindow>
        </div>
      ),
    },
    {
      name: 'Guest emotion faces',
      description:
        'The six 14x14 guest emotion faces (ecstatic, happy, neutral, unhappy, angry, sick) at GuestInfo size (30px) and large (56px) — original pixel art in the spirit of the RCT2 guest-face range: skin-tone discs, expressive brows/eyes/mouths, flushed red anger, green sickness.',
      render: () => (
        <div style={{ position: 'relative', width: '100%', height: 220, background: '#4a5a4a', borderRadius: 8 }}>
          <UIWindow title="Guest Emotions" x={16} y={16} width={440}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {(['faceEcstatic', 'faceHappy', 'faceNeutral', 'faceUnhappy', 'faceAngry', 'faceSick'] as const).map((n) => (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <UIIcon name={n} size={56} />
                  <UIIcon name={n} size={30} />
                  <div style={{ fontSize: 9, opacity: 0.8 }}>{n.slice(4)}</div>
                </div>
              ))}
            </div>
          </UIWindow>
        </div>
      ),
    },
  ],
};

export default previews;

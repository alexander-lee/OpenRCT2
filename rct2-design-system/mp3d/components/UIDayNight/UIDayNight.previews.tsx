import React from 'react';
import { UIDayNight } from './index';
import { Stage, box, ball } from '../Stage';

const previews = {
  componentName: 'UIDayNight',
  importPath: 'components/UIDayNight',
  previews: [
    {
      name: 'Live toggle',
      description:
        'Every Stage renders the switcher top-right automatically — click it to drive the day→night light lerp on this mini scene.',
      render: () => (
        <Stage
          build={(t, g) => {
            g.add(box(t, [1, 1, 1], 0x8a4a3a, [0, 0.5, 0], { tex: 'wood', repeat: [2, 2] }));
            g.add(ball(t, 0.45, 0x3a6a9a, [1.1, 0.45, 0.5], { tex: 'plastic' }));
            g.add(box(t, [0.7, 1.4, 0.7], 0x9a9a9a, [-1.2, 0.7, -0.4], { tex: 'concrete', repeat: [2, 2] }));
          }}
        />
      ),
    },
    {
      name: 'States',
      description: 'Day (sun, raised bevel) and night (moon, pressed-in) states of the icon-only button.',
      render: () => (
        <div style={{ display: 'flex', gap: 12 }}>
          {[false, true].map((n) => (
            <div
              key={String(n)}
              style={{
                position: 'relative',
                width: 120,
                height: 60,
                background: n ? '#0e1728' : '#9ec7d8',
                borderRadius: 8,
              }}
            >
              <UIDayNight night={n} onToggle={() => undefined} />
            </div>
          ))}
        </div>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { UIWindow, UI_TEXT } from './index';
import { Stage, box, cyl, ball } from '../Stage';

// list-row helper demonstrating the mandated typography (rules/ui.md):
// bold name left, muted smaller value right
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '1px 0' }}>
      <span style={UI_TEXT.name}>{label}</span>
      <span style={UI_TEXT.value}>{value}</span>
    </div>
  );
}

const previews = {
  componentName: 'UIWindow',
  importPath: 'components/UIWindow',
  previews: [
    {
      name: 'Windows over a stage',
      description:
        'Two RCT2-chrome windows overlaid on a Stage: a plain draggable guest window (top-left) and the collapsible Park Information window anchored bottom-right. Neither touches the top-right day/night slot.',
      render: () => (
        <div style={{ position: 'relative', width: '100%' }}>
          <Stage
            height={380}
            build={(t, g) => {
              g.add(box(t, [1.4, 0.9, 1.4], 0x8a4a3a, [0, 0.45, 0], { tex: 'wood', repeat: [3, 2] }));
              g.add(cyl(t, 0.08, 0.12, 1.6, 0x5a4632, [-1.6, 0.8, -0.8], { tex: 'wood' }));
              g.add(ball(t, 0.6, 0x3a6e35, [-1.6, 1.8, -0.8], { tex: 'leaf', flat: true }));
              g.add(cyl(t, 0.08, 0.12, 1.6, 0x5a4632, [1.7, 0.8, 0.9], { tex: 'wood' }));
              g.add(ball(t, 0.55, 0x46803c, [1.7, 1.75, 0.9], { tex: 'leaf', flat: true }));
            }}
          />
          <UIWindow title="Guest 42" x={10} y={10} width={190} onClose={() => undefined}>
            <Row label="Happiness" value="High" />
            <Row label="Hunger" value="Low" />
            <Row label="Cash" value="$42.50" />
            <div style={{ ...UI_TEXT.header, marginTop: 4 }}>Thoughts</div>
            <div style={UI_TEXT.value}>&ldquo;The Log Flume looks great!&rdquo;</div>
          </UIWindow>
          <UIWindow title="Park Information" corner="bottom-right" width={210} collapsible>
            <Row label="Guests in park" value="512" />
            <Row label="Park rating" value="842" />
            <Row label="Rides" value="7" />
            <Row label="Stalls" value="3" />
            <Row label="Cash" value="$12,930" />
          </UIWindow>
        </div>
      ),
    },
    {
      name: 'Chrome detail',
      description:
        'The bevelled tan frame, brownish-red title bar, collapse + close buttons and the darker inset content panel, shown flat.',
      render: () => (
        <div style={{ position: 'relative', width: '100%', height: 200, background: '#4a5a4a', borderRadius: 8 }}>
          <UIWindow title="Ride Statistics" x={16} y={16} width={230} collapsible onClose={() => undefined}>
            <div style={{ ...UI_TEXT.header, marginBottom: 2 }}>Ratings</div>
            <Row label="Excitement" value="6.12 (High)" />
            <Row label="Intensity" value="5.40 (High)" />
            <Row label="Nausea" value="3.01 (Medium)" />
            <div style={{ ...UI_TEXT.header, margin: '4px 0 2px' }}>Performance</div>
            <Row label="Max speed" value="42 mph" />
          </UIWindow>
        </div>
      ),
    },
  ],
};

export default previews;

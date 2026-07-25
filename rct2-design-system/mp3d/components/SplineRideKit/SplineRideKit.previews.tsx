import React from 'react';
import { ScenePreview, TrackRide, Station, Lift, Drop, Hill, TurnR } from '../Park';
import { LogFlume } from '../LogFlume';
import { Monorail } from '../Monorail';
import { SplineRideKit } from './index';

const previews = {
  componentName: 'SplineRideKit',
  importPath: 'components/SplineRideKit',
  previews: [
    { name: '3D rig', description: 'One spline workflow, four scenes: a steel mini coaster, a wooden flume trough and an icy bobsled chute (all passing the RCT2 construction rules), plus a derail demo — an unbanked hairpin past the 1.5 g limit whose train launches, derails and explodes, then resets and runs again.', render: () => (
        <ScenePreview distance={15}
      targetY={1.0}>
          <SplineRideKit />
        </ScenePreview>
      ) },
    { name: 'Track pieces', description: 'Piece-composed rides via compileTrackPieces (SETUP §5.1): a steel <TrackRide> authored as JSX piece CHILDREN (<Station/><Lift height={1.6}/><TurnR/><Drop/><TurnR/><Hill/>), a <LogFlume> from a pieces ARRAY on its own flume trough, and a <Monorail pieces> loop beam. Each circuit is auto-closed by the compiler (eased ramp home + shortest arc-straight-arc) and passes checkCoasterDesign + validateSpline — reports in the console. Crash-free by construction.', render: () => (
        <ScenePreview distance={22} targetY={1.0}>
          <TrackRide profile="coaster" type="steel" position={[-1, -7]} name="Piecework Express">
            <Station />
            <Lift height={1.6} />
            <TurnR />
            <Drop />
            <TurnR />
            <Hill height={0.7} />
          </TrackRide>
          <LogFlume
            position={[4.5, -1.5]}
            pieces={['station', { type: 'lift', height: 1.2 }, 'turnL', { type: 'drop', height: 1.2 }, 'turnL', { type: 'straight', length: 2.2 }]}
          />
          <Monorail
            position={[-4.5, 7]}
            pieces={['station', { type: 'straight', length: 1 }, 'turnL', { type: 'straight', length: 3 }, 'turnL', { type: 'straight', length: 3.6 }, 'turnL', { type: 'straight', length: 3 }, 'turnL']}
          />
        </ScenePreview>
      ) },
  ],
};

export default previews;

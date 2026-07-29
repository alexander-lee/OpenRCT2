import React from 'react';
import { ScenePreview, Station, Straight, Lift, Drop, HelixR, TurnR } from '../Park';
import { Bassline } from './index';

const previews = {
  componentName: 'Bassline',
  importPath: 'components/Bassline',
  previews: [
    {
      name: '3D rig',
      description:
        'The Pulse District\'s neon coaster by day. The stock "Sub Bass Circuit": a chain lift out of the station, a descending BANKED 180° turnaround at the crest, a plunge into the long low straight and a bottom turnaround onto a brake tail that lands on the station axis. The two longest straight, level spans are auto-fitted with black-gloss LIGHT TUNNELS (graphite portal fascias, neon hoops lining the bore); the rest of the track is strung with free-standing hoop gates. The station is a club front — gloss platform, chorded canopy, speaker stacks, control cabin and the BASSLINE marquee. Compile numbers: zero synthesized closure, worst clearance 2.91, lateral 1.10 g, 48.3 u lap in 12.9 s.',
      render: () => (
        <ScenePreview distance={24} targetY={1.6} height={560}>
          <Bassline position={[5, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Night (pulsing light tunnels)',
      description:
        "The hero shot. Every hoop runs on the district's shared ~2.2 Hz beat — the same clock <DanceFloor> flashes its tiles to and <Discotron>'s mirror ball scintillates on — over the same magenta/cyan/violet palette. Inside a tunnel the hoops fire in SEQUENCE, one hoop per beat, so the light visibly runs down the bore; the wall base strips breathe with them, the canopy lip and platform edge pulse, the speaker cones thump, and any hoop the train is passing through BLAZES white. Only THREE real PointLights carry it (lead-car headlamp, station canopy, marquee) — the rest is night-gated emissive.",
      render: () => (
        <ScenePreview distance={24} targetY={1.6} height={560} night>
          <Bassline position={[5, 3.4]} />
        </ScenePreview>
      ),
    },
    {
      name: 'Station + marquee (night)',
      description:
        "The club front, framed on the station and turned square to the Stage's fixed 45° camera. Gloss platform on concrete with a chrome hand rail and steps up from the queue, a chorded steel canopy with a beat-pulsed neon lip, a magenta platform-edge strip marking the car line, two speaker stacks whose cones thump on the beat, the control cabin at the brake end and the BASSLINE marquee facing the queue. The train parks here: `createMotionGate` freezes it while guests board, but the tunnels behind keep pulsing on the absolute beat clock. Real guests fill the CoasterCar seats via `seatWorld` when the ride is registered (capacity 6 = 3 cars × 2 seats).",
      render: () => (
        <ScenePreview distance={10} targetY={1.5} height={520} night autoRotate={false}>
          <Bassline rotation={Math.PI / 4} />
        </ScenePreview>
      ),
    },
    {
      name: 'Custom circuit (pieces)',
      description:
        'The circuit takes any compileTrackPieces layout (SETUP §5.1) as piece children or a `pieces` array — here a longer out-and-back with a deeper lift and a wider turnaround. The tunnels are NOT hardcoded to the stock layout: they are auto-fitted to the two longest straight, level spans of whatever gets compiled, so a custom circuit gets its own light tunnels. Remember the two rules — end the list FACING the station (leg B = leg A + 1.5 u, then a 1.2 u brake tail) and plan against the REAL auto-extended `lift`/`drop` advance, not the requested length.',
      render: () => (
        <ScenePreview distance={27} targetY={1.8} height={560} night>
          <Bassline position={[6, 4]}>
            <Station />
            <Straight length={0.6} />
            <Lift height={2} length={9.37} />
            <Straight length={0.8} />
            <HelixR angle={180} radius={3.8} height={-1} />
            <Straight length={1.4} />
            <Drop height={1} length={5.49} />
            <Straight length={6.38} />
            <Straight length={1.6} />
            <TurnR angle={180} radius={3.8} />
            <Straight length={1.2} />
          </Bassline>
        </ScenePreview>
      ),
    },
  ],
};

export default previews;

import React from 'react';
import { MoodFaces } from '../MoodFaces';
import type { FaceItem } from '../MoodFaces';

const FACES: FaceItem[] = [{name:"Very very unhappy",cell:[875,1237,27,25]},{name:"Very unhappy",cell:[903,1237,27,25]},{name:"Unhappy",cell:[931,1237,27,25]},{name:"Neutral",cell:[959,1237,27,25]},{name:"Happy",cell:[987,1237,27,25]},{name:"Very happy",cell:[1015,1237,27,25]},{name:"Very very happy",cell:[1043,1237,27,25]},{name:"Tired",cell:[1071,1237,27,25]},{name:"Very tired",cell:[1099,1237,27,25]},{name:"Sick",cell:[1127,1237,27,25]}];

export function GuestMoodFaces() {
  return <MoodFaces faces={FACES} />;
}

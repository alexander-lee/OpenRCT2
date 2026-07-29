const opts = { profile: 'coaster', type: 'steel' };
export default [{ name: 'Corkscrew Twister (regression)', opts, pieces: [
  'station', {type:'lift',height:1}, 'turnR', 'drop', 'turnR', {type:'straight',length:2}, 'turnL',
  {type:'straight',length:1.3}, 'turnR', {type:'straight',length:1}, 'corkscrewR', {type:'straight',length:0.9},
  'turnR', {type:'straight',length:9.8}, 'turnR', {type:'straight',length:0.9} ]}];

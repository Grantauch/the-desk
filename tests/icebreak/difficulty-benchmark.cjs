// Repeatable synthetic opponent-pressure study. This is NOT human usability,
 // sportsmanship, retention, win-rate or final competitive-balance evidence.
const {fixture}=require('./fixture.cjs'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const seeds=[1021,3079,7129,11827,16703,23003];
const perLevel={},started=performance.now();
for(const level of ['rookie','standard','veteran']){
 const samples=[];
 for(const seed of seeds){
  const {api,f}=fixture();
  api.setSeed(seed);f.config.difficulty=level;api.setMode('regular');api.start();
  let wall=0,simSeconds=0,matchStart=performance.now();
  while(f.phase!=='finished'&&wall<190){
   api.step(1);wall++;simSeconds++;
  }
  assert.equal(f.phase,'finished','match must naturally complete for '+level+' seed '+seed);
  const m=f.matchStats;
  for(const player of f.players){
   assert.ok(Number.isFinite(player.x)&&Number.isFinite(player.z),'finite positions');
   assert.ok(player.x>=-28.2&&player.x<=28.2,'no teleport to out-of-bounds x');
  }
  samples.push({seed,elapsedSteps:simSeconds,
    score:[...f.score],shots:m.teamShots[1],passes:m.teamPasses[1],
    cleanChecks:m.teamChecks[1],saves:m.teamSaves[1],
    opposingWins:f.score[1]>f.score[0]?1:0,simulatedWallMs:Math.round(performance.now()-matchStart)});
 }
 const average=key=>Number((samples.reduce((sum,s)=>sum+s[key],0)/samples.length).toFixed(2));
 perLevel[level]={averageOpposingShots:average('shots'),averageOpposingPasses:average('passes'),
  averageOpposingChecks:average('cleanChecks'),averageOpposingSaves:average('saves'),
  opposingWins:samples.reduce((s,x)=>s+x.opposingWins,0),samples};
 console.log('COMPLETED '+level+': '+JSON.stringify({shots:perLevel[level].averageOpposingShots,
  passes:perLevel[level].averageOpposingPasses,checks:perLevel[level].averageOpposingChecks,
  wins:perLevel[level].opposingWins}));
}
const report={method:'6 fixed seeds per level, 18 full 120-game-second solo matches with an idle human Glaciers center; same goalie/skater physical constants, all teammates Standard',seedCount:seeds.length,
wallClockMs:Math.round(performance.now()-started),results:perLevel};
console.log('BENCHMARK_JSON='+JSON.stringify(report));
if(!Number.isFinite(report.wallClockMs))process.exitCode=1;

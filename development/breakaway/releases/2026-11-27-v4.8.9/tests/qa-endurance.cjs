#!/usr/bin/env node
// V4.8.9 unchanged football engine: node tests/qa-endurance.cjs [firstSeed] [lastSeed]
// Pure game simulation; independent of browser, does not test artwork.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const gameSource=html.split('<script>')[1].split('// Canvas field view, independent of physics and DOM controls.')[0];
const ctx={Math,console};vm.createContext(ctx);
const start=+process.argv[2]||1,end=+process.argv[3]||100;
const harness='\n(function(){'+
'const dt=1/60;let checks=0,done=0,frames=0;'+
'const check=(v,m)=>{if(!v)throw Error(m);checks++};'+
'for(let seed='+start+';seed<='+end+';seed++){'+
'const g=new FootballGame(Math.imul(seed,2654435761)>>>0);g.start();let i=0;'+
'while(g.phase==="playing"&&i<6500){'+
'if((i+seed*17)%173===0)g.trigger(["juke","spin","stiff","hurdle"][seed%4]);'+
'const x=Math.sin(i/60*.7)*.85;g.step(dt,{x,y:1,sprint:seed%2===0});i++;'+
'if(i%100===0){check(Number.isFinite(g.player.x)&&Number.isFinite(g.player.y),"runner "+seed);'+
'check(g.defenders.every(d=>!d.outForDrive||(d.vx===0&&d.vy===0&&d.charge===0)),"downed defender "+seed);'+
'check(g.clock>=0&&g.clock<=60,"clock "+seed);check(g.scoreReconciles(),"ledger "+seed);}}'+
'check(g.phase==="over","full game "+seed);done++;frames+=i;}'+
'this.output={range:['+start+','+end+'],done,frames,checks,pass:true};'+
'}).call(this);';
vm.runInContext(gameSource+harness,ctx,{timeout:150000});
console.log(JSON.stringify(ctx.output,null,2));

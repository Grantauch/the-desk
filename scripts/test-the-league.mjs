import assert from 'node:assert/strict';
import '../public/hubs/the-league/engine.js';
const E=globalThis.League;
let checks=0;
function ok(test,description){assert.ok(test,description);checks++;}
const go=(s,type,data={})=>E.transition(s,{type,...data});
function invariant(s){
  assert.ok(E.validate(JSON.parse(JSON.stringify(s))),`Save valid at ${s.phase}`);
  for(const t of s.teams){assert.ok(t.cash>=0&&Number.isFinite(t.cash));assert.ok(E.rating(t,s.era)>=1&&E.rating(t,s.era)<=8);}
  assert.equal(s.teams.reduce((n,t)=>n+t.titles,0),s.completed);
}
function play(seed,{count=6,mode='class',policy='mixed',inspect=false}={}) {
  let s=E.create({seed,count,mode}),midWinner, steps=0;
  // Rotate identities through seats so ties and turn order cannot masquerade as balance.
  s.teams.forEach((t,i)=>t.strategy=E.STRATEGIES[(i+seed)%6]);
  while(s.phase!=='final'&&steps++<1500){
    if(inspect)invariant(s);
    switch(s.phase){
      case 'history':s=go(s,'begin');break;
      case 'decision':{
        const t=s.teams[s.turn];const d=E.decisionOptions(s);let id=s.era===4?(t.cash>=2?'negotiate':'lockout'):(t.strategy==='community'?'stay':'move');
        if(policy==='chaos')id=d[(seed+s.turn+s.era)%2].id;
        if(d.find(x=>x.id===id).cost>t.cash)id=d.find(x=>!x.cost).id;
        s=go(s,'decision',{id});break;}
      case 'auction':{
        const a=s.auction,lot=E.ERAS[s.era].assets[s.lot];
        const willing=s.teams.filter(t=>t.human&&t.id!==a.high&&!a.passed[t.id]&&t.cash>=a.bid+1).filter(t=>{
          if(policy==='save')return false;
          if(policy==='chaos')return a.bid<Math.min(t.cash,(seed+t.id*3+s.era*7)%18);
          const preferred={dynasty:'talent',media:'media',builder:'stadium',community:'rep',balanced:'fans',saver:'cash'}[t.strategy];
          const cap=Math.min(t.cash-3,Math.round(3+Object.entries(lot.effect).reduce((n,[k,v])=>n+v*(k===preferred?1.9:.5)*(k==='talent'&&E.rating(t,s.era)>5?.5:1),0)));
          return a.bid<cap;
        });
        if(willing.length)s=go(s,'bid',{team:willing[(seed+a.bid)%willing.length].id});else s=go(s,'sell');break;}
      case 'sold':s=go(s,'nextLot');break;
      case 'office':{
        let id=policy==='save'?'save':E.botAction(s,s.teams[s.turn]);
        if(policy==='chaos'){const a=E.actions(s.teams[s.turn],s.era).filter(a=>a.cost<=s.teams[s.turn].cash);id=a[(seed+s.turn+s.era)%a.length].id;}
        s=go(s,'invest',{id});break;}
      case 'season':s=go(s,'season');break;
      case 'results':if(s.era===3)midWinner=E.standings(s)[0].id;s=go(s,'nextEra');break;
      default:throw new Error(s.phase);
    }
  }
  assert.equal(s.phase,'final');if(inspect)invariant(s);
  return {s,midWinner,steps};
}
// The same inputs and seed survive serialization and always produce the same finish.
const first=play(42,{inspect:true}).s;
assert.deepEqual(first,play(42).s);checks++;
for(const n of [2,3,4,5,6])for(const p of ['mixed','save','chaos'])for(let seed=1;seed<=30;seed++)play(seed,{count:n,policy:p,inspect:true});
checks+=450;
for(let seed=1;seed<=100;seed++)play(seed,{mode:'solo',policy:seed%2?'mixed':'chaos',inspect:true});checks+=100;
let s=go(E.create({mode:'class',count:2,seed:4}),'begin'),before=E.copy(s);
assert.throws(()=>go(s,'bid',{team:9}));assert.deepEqual(s,before);checks++;
s=go(s,'bid',{team:0});assert.throws(()=>go(s,'pass',{team:0}));assert.throws(()=>go(s,'bid',{team:0}));checks+=2;
s=go(s,'sell');ok(s.teams[0].cash===15&&s.teams[1].cash===16,'Only winner charged');
ok(E.rating(s.teams[0],0)===5&&E.rating(s.teams[0],1)===5&&E.rating(s.teams[0],3)===3,'Talent expires after two eras');
assert.throws(()=>go(s,'sell'));checks++;
s=go(s,'nextLot');s=go(s,'pass',{team:0});s=go(s,'pass',{team:1});ok(s.phase==='sold'&&s.sold.team===-1,'All pass works');
s=go(s,'nextLot');s.teams[0].cash=0;assert.throws(()=>go(s,'invest',{id:'develop'}));s=go(s,'invest',{id:'save'});checks++;
ok(s.turn===1,'Each team gets exactly one investment');
s=go(s,'invest',{id:'save'});s=go(s,'season');let ended=go(s,'finish');ok(ended.completed===1&&ended.phase==='final','Early finish uses completed season');
assert.throws(()=>go(s,'season'));checks++;
let labor=E.create({mode:'class',count:2});labor.era=4;labor=go(labor,'begin');labor=go(labor,'decision',{id:'lockout'});ok(E.rating(labor.teams[0],4)===2&&E.rating(labor.teams[0],5)===2&&E.rating(labor.teams[0],6)===3,'Lockout penalty expires');
let move=E.create({mode:'class',count:2});move.era=5;move=go(move,'begin');move=go(move,'decision',{id:'move'});ok(move.teams[0].cash===22&&move.teams[0].fans===2&&move.teams[0].rep===2&&move.teams[0].stadium===3,'Relocation real tradeoff');
let broken=E.copy(first);broken.teams[0].cash=NaN;ok(!E.validate(broken),'Reject invalid cash');broken=E.copy(first);broken.season.rolls=[];ok(!E.validate(broken),'Reject malformed result save');broken=E.copy(first);broken.teams[0].color='url(evil)';ok(!E.validate(broken),'Reject injected style');
const runs=Number(process.env.LEAGUE_SIMULATIONS||3000),wins=Object.fromEntries(E.STRATEGIES.map(x=>[x,0]));let comeback=0,champions=0,steps=0,maxTitle=0;
for(let seed=1;seed<=runs;seed++){const r=play(seed);const win=E.standings(r.s)[0];wins[win.strategy]++;comeback+=win.id!==r.midWinner;champions+=r.s.teams.filter(t=>t.titles>0).length;steps+=r.steps;maxTitle+=Math.max(...r.s.teams.map(t=>t.titles));}
const soloPolicyWins={};
for(const policy of ['save','mixed','chaos']){let won=0;for(let seed=1;seed<=300;seed++){const r=play(seed,{mode:'solo',policy});won+=E.standings(r.s)[0].id===0;}soloPolicyWins[policy]=Math.round(won/3*10)/10;}
console.log(JSON.stringify({checks,completeStressGames:550,balanceSimulations:runs,scriptedStrategyWins:wins,soloPolicyWinPercentOver300Each:soloPolicyWins,changedLeaderAfterEra4:Math.round(comeback/runs*1000)/10,averageDistinctChampions:Math.round(champions/runs*100)/100,averageMostTitles:Math.round(maxTitle/runs*100)/100,averageCommands:Math.round(steps/runs),caveat:'Scripted policies test rules and strategy diversity, not student enjoyment or all possible exploits.'},null,2));

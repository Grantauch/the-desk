const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.join(__dirname, '../public/hubs/blacktop-kings');
const ctx = new Proxy(()=>{}, {get:(_,k)=>k==='measureText'?()=>({width:10}):()=>ctx,set:()=>true});
const sounds=[], levels=[];
let randomDraws=0;
const math=Object.create(Math);math.random=()=>{randomDraws++;return Math.random();};
const window={BK:{},devicePixelRatio:1,addEventListener(){},dispatchEvent(){}};
const sandbox={window,Math:math,console,performance:{now:()=>0},document:{createElement:()=>({getContext:()=>ctx})}};
window.BK.assets={get:()=>null,board:()=>null,fans:[],ensureCourt(){},surface:()=>null};
vm.createContext(sandbox);
for(const f of ['data.js','input.js','art-baller.js','art-court.js','fx.js','game-core.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),sandbox,{filename:f});
const BK=window.BK,C=BK.art.COURT;
BK.audio={sfx:(name,vol)=>sounds.push({name,vol}),crowd:v=>levels.push(v),intensity(){}};
function match(){
 const teams=BK.data.QUICK_CREWS.slice(0,2).map(q=>({name:q.name,colors:q.colors,logo:q.logo,players:q.members.map(id=>BK.data.LEGEND_BY_ID[id])}));
 const m=new BK.Match({getContext:()=>ctx,clientWidth:1280},{court:BK.data.COURTS[0],teams,target:99,humans:[]});
 m.phase='live';m.players.forEach((p,i)=>{p.x=2;p.y=i*3;p.vx=p.vy=0;});
 const p=m.players[0];p.x=C.rimX-22.5;p.y=0;m.giveBall(p,true);m.cleared=true;sounds.length=0;return {m,p};
}
// Green feedback is tied to a judged human release; poor timing cannot light it.
for(const [off,green] of [[0,true],[0.2,false]]){
 const {m,p}=match();m.startJumpShot(p,{human:true});m.releaseShot(p,p.shot.apex+off);
 assert.equal(p.greenT>0,green);assert.equal(sounds.some(s=>s.name==='green'),green);
}
// Impact freeze and camera punches remain brief, and motion reduction removes both.
for(const name of ['bigdunk','block','ankles','crownOn']){
 const {m}=match();m.fx.preset(name,30,0,4);
 assert.ok(m.fx.stopT>0&&m.fx.stopT<=0.06,`${name}: bounded hit-stop`);
 assert.ok(m.fx.zoomTarget>0&&m.fx.zoomTarget<=0.12,`${name}: bounded camera punch`);
 const {m:reduced}=match();reduced.fx.reduced=true;reduced.fx.preset(name,30,0,4);
 assert.equal(reduced.fx.stopT,0);assert.equal(reduced.fx.zoomTarget,0);
 assert.equal(reduced.fx.shakeAmp,0);assert.equal(reduced.fx.flashT,0);assert.equal(reduced.fx.slowT,0);
}
// Every audible bounce comes from contact with the floor, not a scheduled shot outcome.
// Side-cut feedback cannot consume the randomness used by AI, shots, or the original dust trigger.
{
 const {m,p}=match();p.vx=p.speed*0.9;p.vy=0;p.plantT=p.cutT=0;
 const before=randomDraws;m.drive(p,0,p.speed*0.9,1/60,p.speed);
 assert.ok(p.cutT>0);assert.equal(randomDraws,before);assert.equal(p.plantT,0);
}
{
 const {m}=match(),b=m.ball;b.state='loose';b.holder=null;b.x=10;b.y=0;b.z=0.45;b.vz=-14;b.vx=b.vy=0;
 m.ballStep(1/60);assert.equal(sounds.filter(s=>s.name==='floor').length,1);
 sounds.length=0;b.z=6;b.vz=2;m.ballStep(1/60);assert.equal(sounds.length,0);
}
// The board collision already spoke; scoring a bank cannot play it a second time.
{
 const {m,p}=match();m.scoreBasket(p,'jumper',true,{bank:true});assert.equal(sounds.filter(s=>s.name==='board').length,0);
}
// Human clock cues occur once at each final whole-second crossing and stop during a shot.
{
 const {m,p}=match();m.humans=[{team:0}];m.shotClock=3.01;m.runShotClock(0.02);m.runShotClock(0.02);
 assert.equal(sounds.filter(s=>s.name==='clock').length,1);p.state='shoot';m.shotClock=2.01;m.runShotClock(0.02);
 assert.equal(sounds.filter(s=>s.name==='clock').length,1);
}
// Tight late games increase the crowd bed without crossing its bound.
{
 const {m}=match();m.target=15;m.excite=0.2;m.teams[0].score=1;m.teams[1].score=0;m.updateAudio();const calm=levels.at(-1);
 m.teams[0].score=13;m.teams[1].score=12;m.shotClock=2;m.updateAudio();assert.ok(levels.at(-1)>calm&&levels.at(-1)<=0.38);
}
// Follow-through moves continuously from the set point to the snapped wrist.
{
 const A=BK.art,d=A.dims(78,'athletic');let prev=null;
 for(let i=0;i<=20;i++){const pose=A.pose('jumpshot',{dims:d,t:0.6,released:true,releaseBlend:i/20});if(prev)assert.ok(Math.hypot(pose.handF[0]-prev[0],pose.handF[1]-prev[1])<0.35);prev=pose.handF;}
 const neutral=A.pose('idle',{dims:d}),land=A.pose('idle',{dims:d,land:0.8});assert.ok(land.pelvis[1]<neutral.pelvis[1]);
}
console.log('Blacktop feel: release feedback, reduced motion, bounded impact, collision audio, clock cues, clutch crowd and continuous follow-through passed.');

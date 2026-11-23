const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs');
const DT=1/90;
function setup(opts={}){
 const t=fixture(),{f,api}=t;
 if(opts.goalie){api.setSeat(0,0,'ai');api.setSeat(0,3,'kb1')}
 if(opts.multiplayer)api.setSeat(1,0,'kb2');
 if(opts.keyboard2){api.setSeat(0,0,'ai');api.setSeat(0,1,'kb2')}
 if(opts.pad){api.setSeat(0,0,'ai');api.setSeat(0,1,'pad0')}
 api.start();f.clear();
 for(const p of f.players)p.stun=0;
 return t;
}
function passPlay(t){
 const {f}=t,p=f.players.find(q=>q.device==='kb1'),receiver=f.players.find(q=>q.team===p.team&&!q.goalie&&q!==p&&q.id===1),other=f.players.find(q=>q.team===p.team&&!q.goalie&&q!==p&&q!==receiver);
 assert.ok(receiver&&other);
 Object.assign(p,{x:0,z:0,facing:0,vx:0,vz:0,receiveWait:0});
 Object.assign(receiver,{x:3,z:.38,vx:0,vz:0,receiveWait:0});
 Object.assign(other,{x:-14,z:7});
 for(const e of f.players.filter(p=>p.team!==0&&!p.goalie)){e.x=24;e.z=10}
 f.give(p);
 f.pass(p);
 assert.equal(f.puck.passTarget,receiver);
 for(let i=0;i<50&&!f.puck.owner;i++)f.puckPhysics(DT);
 return {p,receiver,other};
}
test('Q switches the only human to an eligible same-team skater without teleporting any bodies or puck',()=>{
 const {f,api}=setup();
 const original=f.humanFor('kb1'),wing=f.players[1],defender=f.players[2];
 Object.assign(original,{x:-5,z:1,vx:3,energy:.4});
 Object.assign(wing,{x:10,z:4});
 Object.assign(defender,{x:2,z:0,vx:-4,energy:.7});
 Object.assign(f.puck,{owner:null,x:2,z:0,vx:2,vz:-1});
 const before=f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.energy]),puck=[f.puck.x,f.puck.z,f.puck.vx,f.puck.vz];
 api.input('q',true);
 assert.equal(f.humanFor('kb1'),defender);assert.equal(f.control,defender);
 assert.equal(original.device,'ai');assert.equal(defender.device,'kb1');
 assert.deepEqual(f.players.map(p=>[p.x,p.z,p.vx,p.vz,p.energy]),before);
 assert.deepEqual([f.puck.x,f.puck.z,f.puck.vx,f.puck.vz],puck);
 assert.equal(f.players.filter(p=>p.device!=='ai').length,1);
 assert.equal(f.matchStats.humanDevice,'kb1');
 api.input('q',true,true);assert.equal(f.control,defender,'key autorepeat must not switch twice');
 api.input('q',false);api.input('q',true);
 assert.equal(f.control,original,'second real press can bring the player back to a nearby teammate');
});
test('manual switch cannot leave a human puck carrier or a human goalie',()=>{
 const t=setup(),{f}=t,p=f.humanFor('kb1');
 f.give(p);assert.equal(f.switchPlayer('kb1'),false);assert.equal(f.puck.owner,p);
 assert.equal(p.device,'kb1');assert.equal(f.players.filter(q=>q.device==='kb1').length,1);
 const g=setup({goalie});
 assert.equal(g.f.humanFor('kb1').goalie,true);
 assert.equal(g.f.switchPlayer('kb1'),false);
 assert.equal(g.f.players.filter(q=>q.device!=='ai').length,1);
});
test('manual control transfer excludes opponents, goalie, fallen, stunned or otherwise occupied skaters',()=>{
 const {f}=setup(),p=f.humanFor('kb1'),wing=f.players[1],defender=f.players[2];
 wing.stun=2;defender.fallTime=.7;
 assert.equal(f.switchPlayer('kb1'),false);
 assert.equal(f.control,p);
 wing.stun=0;
 assert.equal(f.switchPlayer('kb1',defender),false,'cannot manually select a fallen defender');
 assert.equal(f.switchPlayer('kb1',f.players[3]),false,'never switch into the opposing team');
 assert.equal(f.switchPlayer('kb1',wing),true);assert.equal(f.control,wing);
});
test('switching clears stale shooting/checking presses but preserves held movement and burst direction',()=>{
 const {f}=setup();const input=f.inputFor('kb1');
 Object.assign(input,{up:true,axisX:.3,burst:true,pass:true,shoot:true,check:true});
 const original=f.humanFor('kb1'),before=f.puck.owner;
 original.shotCharge=.8;original.oneTimerBuffer=.3;
 assert.equal(f.switchPlayer('kb1'),true);
 assert.equal(input.up,true);assert.equal(input.axisX,.3);assert.equal(input.burst,true);
 assert.equal(input.pass,false);assert.equal(input.shoot,false);assert.equal(input.check,false);
 assert.equal(original.shotCharge,0);assert.equal(original.oneTimerBuffer,0);
 assert.equal(f.puck.owner,before);
});
test('a real completed solo pass follows its intended AI receiver and credits the human passer',()=>{
 const t=setup(),{f}=t,{p,receiver}=passPlay(t);
 assert.equal(f.puck.owner,receiver);
 assert.equal(p.device,'ai');assert.equal(receiver.device,'kb1');
 assert.equal(f.control,receiver);
 assert.equal(f.matchStats.human.passes,1);
 assert.equal(f.matchStats.teamPasses[0],1);
 assert.ok(p.cutReceiver===receiver,'original passer is now an AI runner for the give-and-go');
 f.shot(receiver,.7);
 assert.equal(f.matchStats.human.shots,1,'human still owns subsequent shot after switching');
 assert.equal(f.matchStats.human.passes,1);
});
test('follow-pass opt-out keeps original skater selected, preserves the completed pass',()=>{
 const t=setup(),{f}=t;f.config.autoFollow=false;
 const {p,receiver}=passPlay(t);
 assert.equal(f.puck.owner,receiver);assert.equal(f.control,p);
 assert.equal(p.device,'kb1');assert.equal(receiver.device,'ai');
 assert.equal(f.matchStats.human.passes,1);
});
test('interception never steals human controls or counts as a completed pass',()=>{
 const t=setup(),{f}=t,p=f.humanFor('kb1'),receiver=f.players[1],third=f.players[2],enemy=f.players[3];
 Object.assign(p,{x:0,z:0,vx:0,vz:0,facing:0});
 Object.assign(receiver,{x:8,z:.4,vx:0,vz:0,receiveWait:0});
 Object.assign(third,{x:-14,z:7});
 Object.assign(enemy,{x:2.8,z:.12,vx:0,vz:0,receiveWait:0});
 f.give(p);f.pass(p);assert.equal(f.puck.passTarget,receiver);
 for(let i=0;i<50&&!f.puck.owner;i++)f.puckPhysics(DT);
 assert.equal(f.puck.owner,enemy);
 assert.equal(f.control,p);assert.equal(p.device,'kb1');
 assert.equal(f.matchStats.human.passes,0);assert.equal(f.matchStats.teamPasses[0],0);
});
test('two human players keep their fixed eight-seat ownership even after key switches and passes',()=>{
 const t=setup({multiplayer:true}),{f,api}=t,p=f.humanFor('kb1'),other=f.humanFor('kb2');
 assert.equal(f.matchStats.solo,false);
 assert.equal(f.switchPlayer('kb1'),false);
 api.input('q',true);api.input('.',true);
 assert.equal(f.humanFor('kb1'),p);assert.equal(f.humanFor('kb2'),other);
 assert.equal(f.players.filter(q=>q.device!=='ai').length,2);
 const ally=f.players[1];
 f.give(p);f.pass(p);for(let i=0;i<90&&!f.puck.owner;i++)f.puckPhysics(DT);
 assert.equal(f.humanFor('kb1'),p);
 assert.equal(f.matchStats.human.passes,0,'multiplayer cannot claim a solo record');
});
test('keyboard 2 solo seat can change skaters with period, not the other keyboard shortcut',()=>{
 const {f,api}=setup({keyboard2:true}),old=f.humanFor('kb2');
 assert.equal(old?.id,1);
 api.input('q',true);assert.equal(f.humanFor('kb2'),old);
 api.input('.',true);
 assert.notEqual(f.humanFor('kb2'),old);
 assert.equal(f.players.filter(p=>p.device==='kb2').length,1);
 assert.equal(f.players.filter(p=>p.device==='kb1').length,0);
});
test('gamepad Y has a rising edge and does not shoot/pass/check upon control transfer',()=>{
 const {f,pads}=setup({pad:true}),original=f.humanFor('pad0');
 const pad={axes:[0,0],buttons:Array.from({length:8},()=>({pressed:false}))};
 pads[0]=pad;
 pad.buttons[2].pressed=true;pad.buttons[3].pressed=true;
 f.pollGamepads();
 const first=f.humanFor('pad0');
 assert.notEqual(first,original);
 assert.equal(f.matchStats.human.shots,0);
 assert.equal(f.puck.owner,null);
 f.pollGamepads();assert.equal(f.humanFor('pad0'),first,'holding Y never cycles repeatedly');
 pad.buttons[3].pressed=false;pad.buttons[2].pressed=false;f.pollGamepads();
 pad.buttons[3].pressed=true;f.pollGamepads();
 assert.notEqual(f.humanFor('pad0'),first,'second press after release switches');
});
test('faceoff retains selected skater while a new match restores the configured seat',()=>{
 const {f,api}=setup(),original=f.humanFor('kb1');
 assert.equal(f.switchPlayer('kb1'),true);const current=f.humanFor('kb1');
 f.resetFaceoff();assert.equal(f.humanFor('kb1'),current);
 assert.equal(f.players.filter(p=>p.device!=='ai').length,1);
 api.goal(1); // a scored stoppage must never change keyboard ownership
 assert.equal(f.humanFor('kb1'),current);
 f.finish();api.start();
 assert.equal(f.humanFor('kb1').id,original.id);
 assert.equal(f.players.filter(p=>p.device!=='ai').length,1);
});

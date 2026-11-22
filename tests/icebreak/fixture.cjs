const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../../public/hubs/icebreak.html');
// Instrument only the test copy. The shipped page has no scenario editor.
const hook = `window.fixture={makePlayer,bodyPose,skate,steer,ai,updatePlayers,finish,newMatchStats,finalizeMatch,renderShiftBook,renderFinalReport,challengeForDay,challengeValue,awardDaily,localDay,dayOrdinal,sanitizedProgress,newProgress,get matchStats(){return matchStats},get shiftProgress(){return shiftProgress},get shiftStorageAvailable(){return shiftStorageAvailable},advanceFrame,goalCrossing,segmentCircleTime,puckPhysics,releasePuck,stickPoint,shot,pass,goalieClear,render,updateHUD,possessionHUD,step,inputFor,pollGamepads,limitPlayer,SKATE,STICK,CONTACT,get players(){return players},get puck(){return puck},get config(){return config},get control(){return control},get phase(){return phase},get score(){return score},get injuryTime(){return injuryTime},get injured(){return injured},beginCheck,collideSkaters,resetFaceoff,endInjury,CHECK,ROLE_MASS,setDrop:v=>dropDelay=v,setSeed:v=>seed=v,setPaused:v=>paused=v,clear:()=>{inputState.clear();players.forEach(p=>{p.has=false;p.stun=999;p.vx=p.vz=0});puck.owner=null;puck.lock=0;dropDelay=0;goalDelay=0},give:p=>{players.forEach(q=>q.has=false);p.has=true;puck.owner=p;Object.assign(puck,stickPoint(p))}};`;
const instrument = html => html.replace('\n})();', '\n'+hook+'\n})();');
function fixture(source=fs.readFileSync(file,'utf8'),options={}) {
  const elements=new Map(),events={},pads=[];
  const classList={add(){},remove(){},toggle(){}};
  const context2d=new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  const element=id=>({id,style:{},dataset:{},classList,hidden:false,textContent:'',innerHTML:'',value:'',appendChild(){},focus(){},blur(){},setAttribute(){},removeAttribute(){},addEventListener(type,fn){this.events??={};this.events[type]=fn},querySelectorAll(){return []},getContext:type=>type==='2d'?context2d:null});
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},querySelectorAll(){return []},createElement:()=>element('new')};
  const window={addEventListener:(type,fn)=>events[type]=fn};
  const sandbox={window,document,navigator:{getGamepads:()=>pads},innerWidth:1440,innerHeight:900,devicePixelRatio:1,console,structuredClone,localStorage:options.localStorage,setTimeout(){},requestAnimationFrame(){}};
  vm.createContext(sandbox);
  vm.runInContext(instrument(source).match(/<script>([\s\S]*?)<\/script>/)[1],sandbox,{filename:'icebreak.html'});
  return {f:window.fixture,api:window.__ICEBREAK_TEST__,elements,events,pads,sandbox};
}
module.exports={fixture,instrument,file};

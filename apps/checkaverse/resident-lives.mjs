// Authored resident lives. This module never changes a trainer, pet or shop stock.
const props = o => Object.fromEntries((o.properties || []).map(p => [p.name,p.value]));
const key = p => `${p.room}:${p.x},${p.y}`;
const same = (a,b) => a.room===b.room && a.x===b.x && a.y===b.y;
const distance = (a,b) => a.room===b.room ? Math.abs(a.x-b.x)+Math.abs(a.y-b.y) : Infinity;
const copy = x => structuredClone(x);
export function combineResidentLayouts(layouts){for(const l of layouts)if(l.type!=='map'||l.orientation!=='orthogonal'||l.tilewidth!==32||l.tileheight!==32)throw Error('resident homes: expected orthogonal 32px Tiled maps');return{layers:layouts.flatMap(l=>l.layers)};}

export function augmentResidentMap(base, tiled, name) {
  const layer=tiled.layers.find(l=>l.type==='tilelayer'&&props(l).map===name);
  if(!layer || base.rows.length!==props(layer).baseHeight || base.rows[0].length!==layer.width) return base;
  const map=copy(base),rows=map.rows.map(r=>[...r]);
  const codes={1:'.',2:'P',3:'T',4:'F',5:'H'};
  while(rows.length<layer.y+layer.height) rows.push(Array(layer.width).fill('T'));
  if(layer.data.length!==layer.width*layer.height)throw Error('resident homes: invalid Tiled tile layer');
  layer.data.forEach((gid,i)=>{if(gid){if(!codes[gid])throw Error('resident homes: unknown tile');const y=layer.y+Math.floor(i/layer.width),x=i%layer.width;if(y<base.rows.length-1&&base.rows[y][x]!==codes[gid])throw Error('resident homes: the extension cannot overwrite an existing map tile');rows[y][x]=codes[gid];}});
  const houses=tiled.layers.find(l=>l.type==='objectgroup'&&props(l).map===name)?.objects||[];
  map.residentHomes=houses.map(o=>{
    const p=props(o),x=o.x/32,b=(o.y+o.height)/32,w=o.width/32,h=o.height/32;
    if(!Number.isInteger(x)||!Number.isInteger(b)||w!==5||h!==3||!p.resident||!['house-cottage','house-stump','house-creek'].includes(p.art))throw Error('resident homes: malformed house');
    return{id:p.resident,map:name,x,b,w,door:{x:x+2,y:b-1},approach:[x+2,b]};
  });
  map.props.push(...houses.map(o=>{const p=props(o);return{s:p.art,x:o.x/32,b:(o.y+o.height)/32,w:o.width/32,f:[o.x/32,o.y/32,o.width/32,o.height/32],sign:`resident-home:${p.resident}`,residentHome:p.resident};}));
  map.rows=rows.map(r=>r.join(''));map.baseHeight=base.rows.length;
  return map;
}

export function createPlanner(maps, house) {
  const homes=new Map(Object.values(maps).flatMap(m=>(m.residentHomes||[]).map(h=>[h.id,h]))),cache=new Map();
  const mapFor=room=>room.startsWith('home:')?house:maps[room];
  const open=(room,x,y)=>{const ch=mapFor(room)?.rows[y]?.[x];return Boolean(ch)&&!(room.startsWith('home:')?'XBKND':'TWHSLGCRA').includes(ch);};
  function grid(from,to,blocked=new Set()){
    if(from.room!==to.room||!open(to.room,to.x,to.y))return null;
    const q=[from],seen=new Map([[key(from),null]]);
    for(let i=0;i<q.length;i++){
      const p=q[i];if(same(p,to)){
        const out=[];let cur=p;
        while(!same(cur,from)){out.unshift(cur);cur=seen.get(key(cur));}return out;
      }
      for(const [ax,ay] of [[0,1],[1,0],[0,-1],[-1,0]]){
        const n={room:p.room,x:p.x+ax,y:p.y+ay},k=key(n);
        if(!seen.has(k)&&open(n.room,n.x,n.y)&&!(typeof blocked==='function'?blocked(n):blocked.has(k))){seen.set(k,p);q.push(n);}
      }
      if(seen.size>6000)break;
    }
    return null;
  }
  function route(from,to){
    const cacheKey=`${key(from)}>${key(to)}`;
    if(cache.has(cacheKey))return copy(cache.get(cacheKey));
    if(from.room===to.room)return grid(from,to);
    let p={...from},path=[];
    const append=target=>{const leg=grid(p,target);if(!leg)return false;path.push(...leg);p={...target};return true;};
    if(p.room.startsWith('home:')&&p.room!==to.room){
      const h=homes.get(p.room.slice(5));if(!h||!append({room:p.room,x:house.enter[0],y:house.enter[1]}))return null;
      p={room:h.map,x:h.approach[0],y:h.approach[1]};path.push({...p,portal:true});
    }
    const targetHome=to.room.startsWith('home:')?homes.get(to.room.slice(5)):null;
    const targetMap=targetHome?.map||to.room;
    if(p.room!==targetMap){
      const exit=maps[p.room]?.exits?.find(e=>e.to===targetMap);
      if(!exit||!append({room:p.room,x:exit.x,y:exit.y}))return null;
      p={room:targetMap,x:exit.at[0],y:exit.at[1]};path.push({...p,portal:true});
    }
    if(targetHome&&p.room!==to.room){
      if(!append({room:targetHome.map,x:targetHome.approach[0],y:targetHome.approach[1]}))return null;
      p={room:to.room,x:house.enter[0],y:house.enter[1]};path.push({...p,portal:true});
    }
    if(!append(to))return null;
    cache.set(cacheKey,copy(path));if(cache.size>1024)cache.delete(cache.keys().next().value);
    return path;
  }
  return{homes,mapFor,open,grid,route};
}

export function validateLives(content,world,maps,house){
  if(content.version!==1||content.stepMs<250||content.stepMs>1000||content.residents.length!==world.residents.length)throw Error('resident lives: version, speed or roster');
  const planner=createPlanner(maps,house),ids=new Set(),known=new Map(world.residents.map(n=>[n.id,n]));
  const homes=Object.values(maps).flatMap(m=>m.residentHomes||[]);
  if(homes.length!==known.size||new Set(homes.map(h=>h.id)).size!==known.size||homes.some(h=>!known.has(h.id)))throw Error('resident lives: every resident needs exactly one known home');
  for(const life of content.residents){
    const n=known.get(life.id),h=planner.homes.get(life.id),bad=m=>{throw Error(`resident lives: ${life.id}: ${m}`);};
    if(!n||ids.has(life.id)||!h||h.map!==life.homeMap)bad('home or id');ids.add(life.id);
    if(!life.homeDescription||life.homeDescription.length>400||!life.stages?.length||life.stages.length>12)bad('home description or stages');
    if(!['map','can','book','parcel','flowers','cap','tally','shoes','plant','tools'].includes(life.homeObject))bad('home object');
    if(n.errand&&(!n.errand.help?.memory||!life.stages.some(s=>s.id===n.errand.help.next)))bad('story must connect to a real activity');
    let from={room:n.map,x:n.route[0][0],y:n.route[0][1]};
    for(const s of [...life.stages,life.stages[0]]){
      if(!['sweep','water','observe','inspect','deliver','stock','pickup','visit','rest'].includes(s.action)||!(s.seconds>=2&&s.seconds<=120)||!s.label||!s.speech)bad('activity fields');
      if(s.friend&&(!known.has(s.friend)||(known.get(s.friend).map==='kettle')!==(n.map==='kettle')))bad('social scope');
      if((s.map==='kettle')!==(n.map==='kettle')&&!s.map.startsWith('home:'))bad('activity scope');
      const to={room:s.map,x:s.at[0],y:s.at[1]};if(!planner.route(from,to))bad(`unreachable activity ${s.id}`);from=to;
    }
    for(const stage of life.stages.filter(s=>['deliver','stock'].includes(s.action)))if(!life.stages.some(s=>s.action==='pickup'))bad(`unearned ${stage.action}`);
  }
  return planner;
}

export function createResidentSimulation(content,world,planner,{privateTown=false,saved=null}={}){
  const definitions=new Map(content.residents.map(n=>[n.id,n]));
  const allowed=world.residents.filter(n=>(n.map==='kettle')===privateTown);
  let clock=0,seq=0;
  const states=allowed.map(n=>({id:n.id,room:n.map,x:n.route[0][0],y:n.route[0][1],f:'d',stage:0,elapsed:-(definitions.get(n.id).initialDelay||0)*1000,path:null,carry:'',energy:100,completed:0,deliveries:0,received:0,visits:0,helped:0,lastHelpWork:-120000,helpArtifact:'',memory:[],met:{},lastCompleted:'',holdUntil:0,resumeAfter:0,steps:[],stepSeq:0,waited:0}));
  const byId=new Map(states.map(n=>[n.id,n])),marks=new Map();
  for(const n of states){const d=definitions.get(n.id);for(const s of d.stages.filter(s=>['sweep','water','observe','inspect','deliver','stock','visit'].includes(s.action)))marks.set(`${n.id}:${s.id}`,{id:`${n.id}:${s.id}`,resident:n.id,room:s.map,x:s.at[0],y:s.at[1],kind:s.action,...(s.friend?{friend:s.friend}:{}),value:0,count:0});}
  if(saved?.version===1){
    clock=Number.isFinite(saved.clock)?Math.max(0,saved.clock):0;
    for(const raw of saved.residents||[]){const n=byId.get(raw.id);if(!n||!planner.open(raw.room,raw.x,raw.y)||!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>=definitions.get(n.id).stages.length)continue;
      Object.assign(n,{...raw,path:null,holdUntil:0,resumeAfter:0,steps:[],stepSeq:0,energy:Math.max(0,Math.min(100,Number(raw.energy)||0)),memory:(raw.memory||[]).filter(x=>typeof x==='string').slice(-6)});
    }
    for(const m of saved.marks||[]){const out=marks.get(m.id);if(out&&(m.room===out.room||out.kind==='visit'&&planner.open(m.room,m.x,m.y))&&m.kind===out.kind)Object.assign(out,{...(out.kind==='visit'?{room:m.room,x:m.x,y:m.y}:{}),...(['ribbon','label','marker'].includes(m.artifact)?{artifact:m.artifact}:{}),value:Math.max(0,Math.min(out.kind==='deliver'?1e6:100,Number(m.value)||0)),count:Math.max(0,Math.min(1e6,Number(m.count)||0))});}
  }
  function remember(n,text){n.memory.push(text);if(n.memory.length>6)n.memory.shift();n.lastCompleted=text;}
  function step(n,p){n.f=p.room!==n.room?'u':p.x===n.x?(p.y>n.y?'d':'u'):(p.x>n.x?'r':'l');Object.assign(n,{room:p.room,x:p.x,y:p.y});n.stepSeq++;n.steps.push({s:n.stepSeq,room:n.room,x:n.x,y:n.y,f:n.f});if(n.steps.length>5)n.steps.shift();n.energy=Math.max(0,n.energy-.08);}
  function goal(n,s){
    if(s.action==='visit'){
      const friend=byId.get(s.friend);
      if(friend){for(const [ax,ay]of[[0,1],[1,0],[0,-1],[-1,0]])if(planner.open(friend.room,friend.x+ax,friend.y+ay))return{room:friend.room,x:friend.x+ax,y:friend.y+ay};}
    }
    return{room:s.map,x:s.at[0],y:s.at[1]};
  }
  function complete(n,s){
    const mark=marks.get(`${n.id}:${s.id}`);
    if(mark&&s.action!=='visit'&&n.helpArtifact)mark.artifact=n.helpArtifact;
    if(s.action==='pickup')n.carry=s.carry;
    if(s.action==='deliver'&&n.carry==='parcel'){n.deliveries++;n.carry='';if(mark){mark.count++;mark.value=Math.min(1e6,mark.value+1);}remember(n,s.complete);}
    else if(s.action==='stock'&&n.carry==='crate'){n.carry='';if(mark){mark.count++;mark.value=Math.min(4,mark.value+1);}remember(n,s.complete);}
    else if(s.action==='visit'){
      const friend=byId.get(s.friend);
      if(friend&&distance(n,friend)<=2){if(mark)mark.value=0;n.visits++;friend.visits++;n.met[friend.id]=(n.met[friend.id]||0)+1;friend.met[n.id]=(friend.met[n.id]||0)+1;const name=world.residents.find(p=>p.id===friend.id).name;remember(n,`I caught up with ${name}.`);remember(friend,`${world.residents.find(p=>p.id===n.id).name} stopped by for a chat.`);}
      else{if(mark){Object.assign(mark,{room:n.room,x:n.x,y:n.y,value:1});mark.count++;}remember(n,`I left a note for ${world.residents.find(p=>p.id===s.friend).name}.`);}
    }else if(!['deliver','stock'].includes(s.action)){
      if(mark){mark.count++;mark.value=['water','sweep'].includes(s.action)?100:Math.min(4,mark.value+1);}remember(n,s.complete||s.label);
    }
    if(n.id==='nell'&&s.action==='water')for(const m of marks.values())if(m.kind==='deliver'&&m.value>0&&distance(n,m)<=3){n.received+=m.value;remember(n,`I received ${m.value===1?'a clinic parcel':`${m.value} clinic parcels`} from Pax.`);m.value=0;}
    for(const m of marks.values())if(m.kind==='visit'&&m.friend===n.id&&m.value>0&&distance(n,m)<=2){m.value=0;remember(n,`I found a note from ${world.residents.find(p=>p.id===m.resident).name}.`);}
    n.completed++;n.energy=Math.max(0,n.energy-(s.action==='rest'?-45:s.action==='visit'?4:12));
    let next=(n.stage+1)%definitions.get(n.id).stages.length;
    if(n.energy<25&&!n.carry){const home=definitions.get(n.id).stages.findIndex(a=>a.id==='home');if(home>=0&&home!==n.stage)next=home;}
    n.stage=next;n.elapsed=0;n.path=null;n.waited=0;
  }
  function tick(ms,{blocked=()=>false}={}){
    const ticks=Math.max(0,Math.min(Math.ceil(content.catchupSeconds*1000/content.stepMs),Math.floor(ms/content.stepMs)));
    for(let t=0;t<ticks;t++){
      clock+=content.stepMs;seq++;
      for(const m of marks.values())if(['water','sweep'].includes(m.kind))m.value=Math.max(0,m.value-content.stepMs/1000*(m.kind==='water'?.12:.65));
      for(const n of states){
        if(n.holdUntil>clock)continue;
        const s=definitions.get(n.id).stages[n.stage];
        if(n.elapsed<0){n.elapsed+=content.stepMs;continue;}
        if(n.path===null){n.goal=goal(n,s);if(blocked(n.goal)){
          const choices=[[0,1],[1,0],[0,-1],[-1,0]].map(([ax,ay])=>({room:n.goal.room,x:n.goal.x+ax,y:n.goal.y+ay})).filter(p=>planner.open(p.room,p.x,p.y)&&!blocked(p)).sort((a,b)=>distance(n,a)-distance(n,b));if(choices.length)n.goal=choices[0];
        }n.path=planner.route(n,n.goal)||[];}
        if(n.path.length){
          const next=n.path[0];
          if(blocked(next)){n.waited++;if(n.waited%4===0){const cross=n.path.findIndex(p=>p.room!==n.room),end=cross<0?n.path.at(-1):n.path[cross-1];if(end){const around=planner.grid(n,end,blocked);if(around)n.path=[...around,...(cross<0?[]:n.path.slice(cross))];}}continue;}
          n.waited=0;step(n,next);n.path.shift();
        }else{
          n.elapsed+=content.stepMs;if(s.action==='rest')n.energy=Math.min(100,n.energy+content.stepMs/1000*1.5);
          if(n.elapsed>=s.seconds*1000)complete(n,s);
        }
      }
    }
  }
  function view(){return states.map(n=>{
    const d=definitions.get(n.id),s=d.stages[n.stage],h=planner.homes.get(n.id),traveling=n.path===null?!same(n,goal(n,s)):Boolean(n.path.length),preparing=n.elapsed<0,name=world.residents.find(p=>p.id===n.id).name;
    return{id:n.id,room:n.room,x:n.x,y:n.y,f:n.f,seq:n.stepSeq,steps:n.steps,carry:n.carry,energy:Math.round(n.energy),completed:n.completed,deliveries:n.deliveries,received:n.received,visits:n.visits,helped:n.helped,helpArtifact:n.helpArtifact,lastCompleted:n.lastCompleted,memory:n.memory.slice(-3),held:n.holdUntil>clock,
      activity:{id:s.id,label:n.waited?'Waiting for the path to clear':preparing?'Getting ready for the next round':traveling?`On the way: ${s.label.toLowerCase()}`:s.label,action:preparing?'idle':traveling?'walk':s.action,tool:preparing?'none':traveling?(n.carry||'none'):s.tool,speech:n.waited?'I am letting someone past before I continue.':preparing?'I am getting my things together before the next round.':traveling?`I am on my way. ${s.label}.`:s.speech,progress:traveling?0:Math.max(0,Math.min(1,n.elapsed/(s.seconds*1000)))},
      home:{map:h.map,approach:h.approach,title:`${name}'s home`,description:d.homeDescription,object:d.homeObject},workResult:d.workResult};});}
  function reserve(id,owner,seconds=45){const n=byId.get(id);if(!n)return false;if(n.holdUntil>clock)return n.holdOwner===owner;if(n.resumeAfter>clock)return false;n.holdOwner=owner;n.holdUntil=clock+Math.min(45,seconds)*1000;n.resumeAfter=n.holdUntil+10000;return true;}
  function release(owner,id){for(const n of states)if(n.holdOwner===owner&&(!id||id===n.id)){n.holdUntil=0;n.holdOwner='';n.resumeAfter=clock+5000;}}
  function help(id){const n=byId.get(id),h=world.residents.find(r=>r.id===id)?.errand?.help;if(!n||!h)return false;n.helped++;n.helpArtifact=h.artifact;remember(n,h.memory);if(!n.carry&&clock-n.lastHelpWork>=120000){n.stage=definitions.get(id).stages.findIndex(s=>s.id===h.next);n.elapsed=0;n.path=null;n.lastHelpWork=clock;}return true;}
  function serialize(){return{version:1,clock,residents:states.map(n=>{const{path,steps,holdOwner,holdUntil,resumeAfter,goal,...keep}=n;return keep;}),marks:[...marks.values()]};}
  return{states,marks,byId,tick,view,reserve,release,help,serialize,clock:()=>clock,seq:()=>seq};
}

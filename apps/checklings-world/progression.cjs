'use strict';
const {randomBytes,randomInt}=require('node:crypto');
const SLOTS=['dye','pattern','eyes','hat','back','held','decor'];
const NAMES={dye:['Sakura','Matcha','Lavender','Nebula','Midnight','Tangerine','Starlight','Frost'],pattern:['Hearts','Sparks','Clouds','Stripes','Petals','Constellations'],eyes:['Sleepy','Sparkly','Focused','Cyber','Galaxy'],hat:['Beret','Flower Crown','Bow','Visor','Kabuto','Moon Crown'],back:['Butterfly Wings','Jetpack','Cape','Aurora Wings','Meteor Halo'],held:['Boba','Plushie','Book','Foam Blade','Holo Shield','Comet Wand'],decor:['Tea Table','Pond','Flower Bed','Forge','Banner','Observatory','Campfire']};
const ITEMS=Object.freeze(SLOTS.flatMap(slot=>NAMES[slot].map((name,index)=>Object.freeze({id:slot+'-'+index,slot,name,rarity:index>=4?'rare':'common'}))));
const BY_ID=new Map(ITEMS.map(i=>[i.id,i]));
const ACTS={meal:{hunger:24},treat:{hunger:10,joy:14},bath:{clean:28},play:{joy:24,energy:-5},rest:{energy:26},tidy:{clean:19},study:{focus:23}};
const ESSENTIAL=Object.freeze({meal:'hunger',rest:'energy',bath:'clean'});
const ESSENTIAL_FLOOR=45; // free non-reward recovery, never quest or bond farming
const MAX_DUST=999999;
const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
const dayOk=n=>Number.isSafeInteger(n)&&n>=0&&n<10000000;
function visible(s){const {seed,...pet}=s.pet;return {pet,revision:s.revision,stage:s.stage,streak:s.streak,dust:s.dust,crates:s.crates,owned:[...s.owned],equipped:{...s.equipped},vitals:{...s.vitals},bond:s.bond,quests:{completed:[...s.quests.completed],claimed:[...s.quests.claimed]}};}
function advance(s,day){check(dayOk(day)&&day>=s.day,'Invalid official school day');if(day!==s.day){for(const [k,decay] of Object.entries({hunger:7,joy:4,energy:4,clean:6,focus:3}))s.vitals[k]=Math.max(0,s.vitals[k]-decay*Math.min(day-s.day,3));s.day=day;s.actions=0;s.used={};s.quests={completed:[],claimed:[]};}}
function createProgressionService({authorize,calendar,attendance,store,random=randomInt,seed=()=>randomBytes(16).toString('hex')}){
check(typeof authorize==='function'&&typeof calendar==='function'&&typeof attendance==='function'&&store&&typeof store.transact==='function'&&typeof store.load==='function','Requires trusted backend dependencies');
async function context(token){const member=await authorize(token),cal=await calendar();check(member&&typeof member.key==='string'&&member.key.length>0,'Unauthorized');check(cal&&dayOk(cal.day),'Invalid school calendar');return {member,cal};}
async function change(token,action,schoolOnly=true){const {member,cal}=await context(token);if(schoolOnly)check(cal.isSchoolDay===true,'Only on school days');return store.transact(member.key,current=>{check(current?.v===1,'Adopt first');const s=structuredClone(current);advance(s,cal.day);const result=action(s,member,cal);const changed=JSON.stringify(s)!==JSON.stringify(current);if(changed)s.revision++;const saved=changed?s:current;return {state:saved,result:{result,state:visible(saved)}};});}
return {
async adopt(token,species,name){const {member,cal}=await context(token);check(['ember','bolt','mochi','zee'].includes(species),'Invalid species');check(typeof name==='string'&&name.trim().length>0&&[...name.trim()].length<=18&&!/[<>\x00-\x1f]/.test(name),'Invalid name');return store.transact(member.key,current=>{if(current)return {state:current,result:{created:false,state:visible(current)}};const s={v:1,pet:{species,name:name.trim(),seed:seed()},revision:0,stage:0,streak:0,day:cal.day,lastReward:-1,dust:0,crates:0,owned:['dye-1','eyes-0'],equipped:{dye:'dye-1',eyes:'eyes-0'},vitals:{hunger:82,joy:85,energy:84,clean:88,focus:78},bond:0,actions:0,used:{},quests:{completed:[],claimed:[]}};return {state:s,result:{created:true,state:visible(s)}};});},
async load(token){const {member}=await context(token);const s=await store.load(member.key);return s?visible(s):null;},
checkIn(token){return change(token,(s,member,cal)=>{const record=attendance(member,cal);check(record&&!record.then&&record.verified===true&&record.membershipConfirmed===true&&record.day===cal.day&&Number.isSafeInteger(record.bestStreak),'Official check-in verification required');s.streak=Math.max(s.streak,record.bestStreak);s.stage=[0,3,7,14,30].reduce((v,min,i)=>s.streak>=min?i:v,0);if(record.counted===true&&s.lastReward!==cal.day){s.lastReward=cal.day;s.dust=Math.min(MAX_DUST,s.dust+15);s.crates++;s.quests.completed.push('visit');return {awarded:true};}return {awarded:false};});},
care(token,action){check(Object.hasOwn(ACTS,action),'Unknown action');return change(token,(s,member,cal)=>{
 const rewarded=cal.isSchoolDay===true&&s.actions<4&&(s.used[action]||0)<2;
 if (!rewarded) {
  if (Object.hasOwn(ESSENTIAL,action)) {
   const vital=ESSENTIAL[action];
   if(s.vitals[vital]>=ESSENTIAL_FLOOR)return {applied:false,essential:true};
   s.vitals[vital]=ESSENTIAL_FLOOR;
   return {applied:true,essential:true}; // no bond, quests, dust or crates
  }
  check(cal.isSchoolDay===true,'Only on school days');
  return {applied:false};
 }
 for(const [k,v] of Object.entries(ACTS[action]))s.vitals[k]=Math.max(0,Math.min(100,s.vitals[k]+v));
 s.actions++;s.used[action]=(s.used[action]||0)+1;
 if(s.actions<=2)s.bond=Math.min(1000,s.bond+1);
 if(['play','meal'].includes(action)&&!s.quests.completed.includes(action))s.quests.completed.push(action);
 return {applied:true,essential:false};
},false);},
claim(token,quest){return change(token,s=>{check(['visit','meal','play'].includes(quest),'Unknown quest');check(s.quests.completed.includes(quest),'Quest incomplete');if(s.quests.claimed.includes(quest))return {awarded:false};s.quests.claimed.push(quest);s.dust=Math.min(MAX_DUST,s.dust+10);return {awarded:true};});},
equip(token,id){return change(token,s=>{const item=BY_ID.get(id);check(item&&s.owned.includes(id),'Item not owned');s.equipped[item.slot]=id;return {equipped:true};},false);},
craft(token,id){return change(token,s=>{const item=BY_ID.get(id);check(item,'Unknown item');if(s.owned.includes(id))return {created:false};const price=item.rarity==='rare'?160:75;check(s.dust>=price,'Insufficient dust');s.dust-=price;s.owned.push(id);return {created:true,cost:price};});},
open(token,expectedRevision,commandId){return (async()=>{
  check(typeof commandId==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(commandId),'Valid crate command ID required');
  check(Number.isSafeInteger(expectedRevision)&&expectedRevision>=0,'Invalid crate revision');
  const {member,cal}=await context(token);
  return store.transact(member.key,current=>{
   check(current?.v===1,'Adopt first');
   // A bounded retry ledger lives alongside the prototype member state; the
   // real game must use the transactional ck_command_receipts store instead.
   const receipts=Array.isArray(current.crateReceipts)?current.crateReceipts:[];
   const prior=receipts.find(x=>x.commandId===commandId);
   if(prior){
    check(prior.expectedRevision===expectedRevision,'Command ID reused with different revision');
    return {state:current,result:structuredClone(prior.response)};
   }
   check(cal.isSchoolDay===true,'Only on school days'); // new rolls only; old receipts survive closure
   const s=structuredClone(current);
   advance(s,cal.day);
   check(s.revision===expectedRevision,'Stale request');
   check(s.crates>0,'No crates');
   const index=random(ITEMS.length);
   check(Number.isInteger(index)&&index>=0&&index<ITEMS.length,'Invalid random');
   const item=ITEMS[index];
   s.crates--;
   const duplicate=s.owned.includes(item.id);
   if(duplicate)s.dust=Math.min(MAX_DUST,s.dust+25);
   else s.owned.push(item.id);
   s.revision++;
   const response={result:{item,duplicate},state:visible(s)};
   s.crateReceipts=[...receipts,{commandId,expectedRevision,response}].slice(-64);
   return {state:s,result:response};
  });
 })();}
};}
module.exports={ITEMS,createProgressionService};

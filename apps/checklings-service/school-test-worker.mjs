// Synthetic Apps Script runtime in a worker so synchronous UrlFetch can wait
// while the main test thread runs the real asynchronous HTTP/SQL handlers.
import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {classroom,PEOPLE,TEACHER}=require('../../scripts/lib/hall-pass-fixtures.cjs');
const c=classroom({now:new Date(workerData.now),memberships:[[PEOPLE.ada,'Period 1'],[PEOPLE.ada,'Period 2'],[PEOPLE.alan,'Period 1']]});
const h=c.harness;
h.properties.setProperty('CHECKLINGS_BRIDGE_CONFIG',JSON.stringify(workerData.config));
const userStores=new Map();
h.context.CacheService.getUserCache=()=>{
  const email=String(h.state.activeEmail||'');
  if(!userStores.has(email))userStores.set(email,new Map());
  const store=userStores.get(email);
  return {
    get(key){
      const entry=store.get(key);
      if(!entry)return null;
      if(entry.expiresAt<=h.state.now.getTime()){store.delete(key);return null;}
      return entry.value;
    },
    put(key,value,seconds){store.set(key,{value:String(value),expiresAt:h.state.now.getTime()+(Number(seconds)||600)*1000});},
    remove(key){store.delete(key);},
  };
};
h.context.HtmlService.createHtmlOutput=content=>({content,setTitle(){return this;}});
h.context.UrlFetchApp={fetch(url,options){
  if(h.state.lock.held)throw new Error('Network called inside a school workbook lock');
  const shared=new SharedArrayBuffer(20000),head=new Int32Array(shared,0,3);
  parentPort.postMessage({kind:'fetch',url,options,shared});
  if(Atomics.wait(head,0,0,10000)==='timed-out')throw new Error('Synthetic transport timeout');
  const raw=new TextDecoder().decode(new Uint8Array(shared,12,Atomics.load(head,2)));
  return {getResponseCode:()=>Atomics.load(head,1),getContentText:()=>raw};
}};
parentPort.on('message',m=>{
  try {
    h.newRequest();h.signInAs(m.as==='ada'?PEOPLE.ada.email:m.as==='alan'?PEOPLE.alan.email:m.as==='foreign'?'outsider@example.org':m.as==='blank'?'':TEACHER);
    let value;
    if(m.kind==='pin')value=c.pin(PEOPLE.ada);
    else if(m.kind==='call')value=h.call(m.name,...m.args);
    else if(m.kind==='identify')value=h.call('identifyChecklingsGame',m.pin??c.pin(m.person==='alan'?PEOPLE.alan:PEOPLE.ada),'synthetic-'+Math.random(),m.ticket);
    else if(m.kind==='classroomAction') {
      h.clock.set(new Date('2026-09-10T11:30:00Z'));
      const checkIn=c.checkIn(PEOPLE.ada,'Period 1');h.clock.advanceSeconds(1200);const pass=c.requestPass(PEOPLE.ada,'Period 1');
      value={checkedIn:checkIn.state.checkedIn,points:c.checkIns().map(r=>r.Point),passes:c.passLog().map(r=>r.Status),passOutcome:pass.state.actionOutcome};
    }
    else if(m.kind==='facts')value={sheets:h.spreadsheet.getSheets().map(s=>({name:s.getName(),records:s.records()})),pets:Object.fromEntries(Object.entries(h.properties.getProperties()).filter(([k])=>k.startsWith('checkling-v1:'))),mail:h.sentMail};
    else if(m.kind==='appendRoster') {
      for(let i=0;i<m.count;i++)h.sheet('Roster').appendRow(m.duplicate
        ? [PEOPLE.ada.email,PEOPLE.ada.name,'Period 1','synthetic-bad-pin-hash',true,false,'']
        : ['extra'+i+'@students.mtmorrisschools.org','Synthetic Extra '+i,'Period 1','',true,false,'']);
      value=true;
    }
    else if(m.kind==='roster') {
      const row=h.sheet('Roster').records().findIndex(r=>r['Student Email']===PEOPLE.ada.email && r['Class / Period']===(m.period??'Period 1'))+2;
      h.sheet('Roster').getRange(row,m.column).setValue(m.column===4?h.call('hashPin_',m.value):m.value);value=true;
    } else if(m.kind==='config') {
      const next={...workerData.config,...m.patch};
      if(m.patch && Object.prototype.hasOwnProperty.call(m.patch,'gameOrigin') && m.patch.gameOrigin==null) delete next.gameOrigin;
      h.properties.setProperty('CHECKLINGS_BRIDGE_CONFIG',JSON.stringify(next));
      value=true;
    }
    else if(m.kind==='expireSelection') {
      const store=userStores.get(String(h.state.activeEmail||''));
      const entry=store&&store.get(m.handle);
      if(!entry)throw new Error('missing selection');
      if(m.mode==='ttl')entry.expiresAt=h.state.now.getTime()-1000;
      else {
        const parsed=JSON.parse(entry.value);
        parsed.exp=Math.floor(h.state.now.getTime()/1000)-1;
        entry.value=JSON.stringify(parsed);
      }
      value=true;
    }
    else throw new Error('Unknown synthetic worker command');
    parentPort.postMessage({id:m.id,value:JSON.parse(JSON.stringify(value??null))});
  } catch(error) {parentPort.postMessage({id:m.id,error:error.message});}
});

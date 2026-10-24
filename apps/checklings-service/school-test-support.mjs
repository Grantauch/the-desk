// Synthetic school/workbook bridge fixture only. No Google requests or real PINs.
import {Worker} from 'node:worker_threads';
import {randomBytes,randomUUID} from 'node:crypto';
import {createAuthService} from './auth.mjs';
import {createSchoolService} from './school.mjs';
import {createGameStore} from './store.mjs';
import {createGameHandler} from './http.mjs';
import {createRateLimiter} from './rate-limit.mjs';
export async function schoolFixture(database) {
  const now=Date.now(),origin='https://synthetic-checklings.netlify.app';
  const config={enabled:true,issuer:'synthetic_school',audience:'synthetic_game',tenantId:'gas_'+randomUUID().replaceAll('-',''),gameOrigin:origin,classPeriods:['Period 1','Period 2']};
  for(const k of ['assertionKey','flowKey','schoolKey','identityKey'])config[k]=randomBytes(32).toString('base64url');
  const serviceConfig={database,...config,assertionKey:Buffer.from(config.assertionKey),flowKey:Buffer.from(config.flowKey),schoolKey:Buffer.from(config.schoolKey),clock:async()=>now};
  const auth=createAuthService(serviceConfig),school=createSchoolService(serviceConfig),store=createGameStore({database,authorize:auth.authorize,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
  const limiter=createRateLimiter({database,key:randomBytes(32)});
  const handler=createGameHandler({auth,school,store,limiter,origin,schoolLaunchUrl:'https://script.google.com/macros/s/synthetic_only/exec'});
  const requests=[],pending=new Map();let serial=0,transportFailure=false;
  const worker=new Worker(new URL('./school-test-worker.mjs',import.meta.url),{workerData:{config,now}});
  worker.on('message',async m=>{
    if(m.kind==='fetch') {
      requests.push({url:m.url,options:m.options});
      let status=503,raw='{}';
      try {
        if(!transportFailure) {
          const response=await handler(new Request(m.url,{method:'POST',headers:{'Content-Type':m.options.contentType},body:m.options.payload}),{clientAddress:'192.0.2.20'});
          status=response.status;raw=await response.text();
        }
      } catch { /* synthetic failed transport */ }
      const bytes=new TextEncoder().encode(raw),head=new Int32Array(m.shared,0,3);
      new Uint8Array(m.shared,12,bytes.length).set(bytes);Atomics.store(head,1,status);Atomics.store(head,2,bytes.length);Atomics.store(head,0,1);Atomics.notify(head,0);return;
    }
    const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(m.error));else p.resolve(m.value);
  });
  worker.on('error',error=>{for(const p of pending.values())p.reject(error);pending.clear();});
  const invoke=message=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({...message,id});});
  const call=(name,args=[],as='teacher')=>invoke({kind:'call',name,args,as});
  const request=(path,body={},headers={})=>handler(new Request(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Checklings-Request':'1',...headers},body:JSON.stringify(body)}),{clientAddress:'192.0.2.40'});
  async function begin() {
    const response=await request('/auth/launch'),{launchUrl}=await response.json();
    return {ticket:new URL(launchUrl).searchParams.get('ticket'),cookie:response.headers.getSetCookie().find(x=>x.startsWith('__Host-ck-flow=')).split(';')[0]};
  }
  async function approve(l,period='Period 1') {
    const identity=await invoke({kind:'identify',ticket:l.ticket,as:'ada'});
    return {identity,...await call('completeChecklingsGame',[identity.selection,identity.classes.find(x=>x.label===period).id,l.ticket],'ada')};
  }
  async function exchange(l,callbackUrl) {
    const body=Object.fromEntries(new URLSearchParams(new URL(callbackUrl).hash.slice(1)));
    const response=await request('/auth/exchange',body,{Cookie:l.cookie});
    const cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-ck-session=') && !x.startsWith('__Host-ck-session=;'))?.split(';')[0];
    return {response,cookie,token:cookie?.slice('__Host-ck-session='.length)};
  }
  return {config,auth,school,store,handler,requests,invoke,call,request,begin,approve,exchange,failTransport:value=>{transportFailure=value;},close:()=>worker.terminate()};
}

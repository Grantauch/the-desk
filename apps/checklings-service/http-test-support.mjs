// Synthetic test fixtures ONLY. Never import from a service entry point.
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {migrate} from './database.mjs';
import {createAuthService} from './auth.mjs';
import {createGameStore} from './store.mjs';
import {createRateLimiter} from './rate-limit.mjs';
import {createGameHandler} from './http.mjs';
export const schoolUrl='https://script.google.com/macros/s/synthetic_only_not_a_deployment/exec';
export const syntheticPet={raw:JSON.stringify({v:1,species:'ember',name:'Keep my progress',habitat:'sky'}),officialBestStreak:14,importedAt:'2026-10-23T16:00:00.000Z'};
export function signedAssertion(payload,key) {
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+createHmac('sha256',key).update('checklings:bridge:v1\n'+body).digest('base64url');
}
export async function httpFixture({origin='https://synthetic-game.example',limits}={}) {
  const db=await PGlite.create(),database={transaction:work=>db.transaction(work)};
  await migrate(database);
  const tenantId='http_'+randomUUID().replaceAll('-',''),keys={assertionKey:randomBytes(32),flowKey:randomBytes(32)};
  const actors={a:{tenantId,memberId:'member_a',classId:'class_a',authEpoch:0},b:{tenantId,memberId:'member_b',classId:'class_b',authEpoch:0}};
  for(const a of Object.values(actors))await db.query('INSERT INTO ck_memberships (tenant_id,member_id,class_id,active) VALUES ($1,$2,$3,true)',[tenantId,a.memberId,a.classId]);
  let now=Date.now();
  const config={database,tenantId,issuer:'synthetic_school',audience:'synthetic_game',...keys,clock:async()=>now};
  const auth=createAuthService(config),store=createGameStore({database,authorize:auth.authorize,migrationKey:'synthetic-only-migration-key-at-least-32-characters'});
  const limiter=createRateLimiter({database,key:randomBytes(32),...(limits?{limits}:{})});
  const reports=[],handler=createGameHandler({auth,store,limiter,origin,schoolLaunchUrl:schoolUrl,report:x=>reports.push(x)});
  const request=(path,body={},options={})=>{
    const headers=new Headers(options.bridge?{}:{Origin:origin,'X-Checklings-Request':'1'});
    headers.set('Content-Type','application/json');
    if(options.cookie)headers.set('Cookie',options.cookie);
    for(const [key,value] of Object.entries(options.headers??{}))value===null?headers.delete(key):headers.set(key,value);
    return handler(new Request(origin+path,{method:options.method??'POST',headers,...(options.method==='GET'?{}:{body:options.raw??JSON.stringify(body)})}),{clientAddress:options.address??'192.0.2.40'});
  };
  async function approval(ticket,member='a') {
    const [body,signature]=ticket.split('.');
    const expected=createHmac('sha256',keys.flowKey).update('checklings:launch:v1\n'+body).digest('base64url');
    if(expected!==signature)throw new Error('Invalid synthetic game ticket');
    const flow=JSON.parse(Buffer.from(body,'base64url'));
    const claims={v:1,iss:config.issuer,aud:config.audience,...actors[member],flowId:flow.flowId,challenge:flow.challenge,jti:randomBytes(32).toString('base64url'),iat:Math.floor(now/1000),exp:Math.floor(now/1000)+30};
    return {flow,assertion:signedAssertion(claims,keys.assertionKey)};
  }
  async function begin() {
    const response=await request('/auth/launch');
    const {launchUrl}=await response.json(),ticket=new URL(launchUrl).searchParams.get('ticket');
    const flowCookie=response.headers.getSetCookie().find(c=>c.startsWith('__Host-ck-flow=')).split(';')[0];
    return {response,launchUrl,ticket,flowCookie};
  }
  async function login(member='a') {
    const l=await begin(),{flow,assertion}=await approval(l.ticket,member);
    const broker=await request('/bridge/assertion',{assertion},{bridge:true}),{code}=await broker.json();
    const response=await request('/auth/exchange',{flowId:flow.flowId,state:flow.state,code},{cookie:l.flowCookie});
    const cookie=response.headers.getSetCookie().find(c=>c.startsWith('__Host-ck-session=')).split(';')[0];
    return {...l,flow,code,response,cookie,token:cookie.slice(cookie.indexOf('=')+1)};
  }
  return {db,database,auth,store,limiter,config,keys,actors,origin,reports,handler,request,approval,begin,login,advance:ms=>{now+=ms;},now:()=>now,close:()=>db.close()};
}

import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {authPage} from './auth-pages.mjs';
const clientSource=await readFile(new URL('./browser-client.mjs',import.meta.url),'utf8');
const sessionName='__Host-ck-session',flowName='__Host-ck-flow';
const exact=(value,fields)=>value && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).length===fields.length && fields.every(k=>Object.hasOwn(value,k));
class Rejection extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
const demand=(test,status=400,code='invalid_request')=>{if(!test)throw new Rejection(status,code);};
const cookie=(name,value,maxAge)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${name===flowName?'Lax':'Strict'}; Max-Age=${maxAge}`;
const cleared=[cookie(sessionName,'',0),cookie(flowName,'',0)];
function cookies(request) {
  const raw=request.headers.get('cookie')??'';demand(raw.length<=8192);
  const result={};
  for(const piece of raw.split(';')) {
    const index=piece.indexOf('=');if(index<0)continue;
    const name=piece.slice(0,index).trim();
    if(![sessionName,flowName].includes(name))continue;
    demand(!Object.hasOwn(result,name));result[name]=piece.slice(index+1).trim();
  }
  return result;
}
async function jsonBody(request,timeoutMs) {
  demand(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??''),415,'json_required');
  demand(!request.headers.has('content-encoding') || request.headers.get('content-encoding')==='identity',415,'json_required');
  const length=request.headers.get('content-length');
  demand(length===null || /^\d+$/.test(length));demand(length===null || Number(length)<=8192,413,'request_too_large');
  demand(request.body);
  const reader=request.body.getReader(),parts=[];let bytes=0,timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(new Rejection(408,'request_timeout'));void reader.cancel().catch(()=>{});},timeoutMs);});
  try {
    while(true) {
      const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;
      bytes+=value.length;demand(bytes<=8192,413,'request_too_large');parts.push(value);
    }
    const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
    return JSON.parse(text);
  } catch(error) {if(error instanceof Rejection)throw error;throw new Rejection(400,'invalid_request');}
  finally {clearTimeout(timer);void reader.cancel().catch(()=>{});}
}
const expectedErrors=new Map([
  ['Unauthorized',[401,'sign_in_required']],['Creature unavailable',[404,'unavailable']],
  ['Stale creature revision',[409,'conflict']],['Command ID reused with different payload',[409,'conflict']],
  ...['Invalid command ID','Invalid rename command','Invalid nickname','Invalid creature ID'].map(x=>[x,[400,'invalid_request']]),
]);

/** Fetch Request/Response adapter for a SEPARATE game host. No server is started.
 * The hosting layer supplies clientAddress from trusted platform/socket metadata.
 */
export function createGameHandler({auth,store,school:schoolService,limiter,origin,schoolLaunchUrl,report=()=>{},bodyTimeoutMs=2000}) {
  const game=new URL(origin),school=new URL(schoolLaunchUrl);
  if(game.protocol!=='https:' || game.origin!==origin || game.username || game.password || school.protocol!=='https:' || school.hostname!=='script.google.com' || school.port || school.username || school.password || school.search || school.hash || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(school.pathname) || !auth || !store || typeof limiter?.take!=='function' || !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs<1 || bodyTimeoutMs>10000)
    throw new Error('Invalid private HTTP configuration');
  const routes=new Map([['/auth/launch','launch'],['/auth/exchange','exchange'],['/auth/logout','logout'],['/bridge/assertion','bridge'],['/bridge/school','bridge'],['/api/creature','command'],['/api/rename','command']]);
  return async function handle(request,{clientAddress}={}) {
    const nonce=randomBytes(24).toString('base64');
    const headers=new Headers({'Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin',
      'Cross-Origin-Resource-Policy':'same-origin','Strict-Transport-Security':'max-age=31536000',
      'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}' 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`});
    const reply=(status,payload,type='application/json; charset=utf-8')=>{
      headers.set('Content-Type',type);return new Response(type.startsWith('application/json')?JSON.stringify(payload):payload,{status,headers});
    };
    const sessionWindow=async token=>headers.set('X-Checklings-Session-Remaining-Ms',String((await auth.sessionWindow(token)).remainingMs));
    let scope='unknown',path='';
    try {
      const url=new URL(request.url);path=url.pathname;
      demand(url.origin===origin && !url.search,400);
      if(['/auth/start','/auth/callback','/auth/client.js'].includes(path)) {
        demand(request.method==='GET',405,'method_not_allowed');
        return reply(200,path==='/auth/client.js'?clientSource:authPage(path==='/auth/callback'?'callback':'start',nonce),path==='/auth/client.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
      }
      scope=routes.get(path);demand(scope,404,'unavailable');
      demand(request.method==='POST',405,'method_not_allowed');
      if(scope==='bridge') {
        // Browsers cannot call the private assertion transport, including from
        // this origin. HMAC verification is still mandatory for server callers.
        demand(!request.headers.has('origin') && !request.headers.has('cookie') && !request.headers.has('sec-fetch-site'),403,'forbidden');
      } else {
        demand(request.headers.get('origin')===origin && request.headers.get('x-checklings-request')==='1',403,'forbidden');
        demand(!request.headers.has('sec-fetch-site') || request.headers.get('sec-fetch-site')==='same-origin',403,'forbidden');
      }
      const allowed=await limiter.take(scope,clientAddress);
      // Exhausted shared-school quotas must never prevent a verified Done action.
      demand(allowed || scope==='logout',429,'try_later');
      const body=await jsonBody(request,bodyTimeoutMs);
      if(scope==='bridge') {
        if(path==='/bridge/school') {
          demand(typeof schoolService?.acceptSnapshot==='function',404,'unavailable');
          demand(exact(body,['snapshot']));return reply(200,await schoolService.acceptSnapshot(body.snapshot));
        }

        demand(exact(body,['assertion']));
        const result=await auth.acceptAssertion(body.assertion);return reply(200,{code:result.code});
      }
      const jar=cookies(request),token=jar[sessionName],proof=jar[flowName];
      if(scope==='launch' || scope==='logout') {
        demand(exact(body,[]));
        headers.append('Set-Cookie',cleared[0]);
        if(scope==='logout')headers.append('Set-Cookie',cleared[1]);
        await auth.cancelLaunch(proof);await auth.logout(token);
        if(scope==='logout')return reply(200,{ok:true});
        const started=await auth.beginLaunch();
        headers.append('Set-Cookie',cookie(flowName,started.flowCookie,60));
        const destination=new URL(school);destination.searchParams.set('mode','checklings');destination.searchParams.set('ticket',started.ticket);
        return reply(200,{launchUrl:destination.href});
      }
      if(scope==='exchange') {
        demand(exact(body,['flowId','state','code']));
        const {token:session}=await auth.exchange({...body,flowCookie:proof});
        await sessionWindow(session);
        headers.append('Set-Cookie',cookie(sessionName,session,900));headers.append('Set-Cookie',cookie(flowName,'',0));
        return reply(200,{ok:true});
      }
      demand(Boolean(token),401,'sign_in_required');
      if(path==='/api/creature') {
        demand(exact(body,['creatureId']));
        const creature=await store.load(token,body.creatureId);
        demand(creature,404,'unavailable');await sessionWindow(token);return reply(200,{creature});
      }
      demand(exact(body,['commandId','input']));
      const saved=await store.rename(token,body.commandId,body.input);await sessionWindow(token);
      return reply(200,saved);
    } catch(error) {
      const known=error instanceof Rejection?[error.status,error.code]:expectedErrors.get(error.message);
      const [status,code]=known??[503,'service_unavailable'];
      if(!known) {try {void Promise.resolve(report({event:'request_failed',scope:scope??'unknown',status})).catch(()=>{});} catch { /* monitoring cannot change a response */ }}
      if(status===405)headers.set('Allow',['/auth/start','/auth/callback','/auth/client.js'].includes(path)?'GET':'POST');
      if(status===429)headers.set('Retry-After','60');
      if(path==='/auth/logout' || path==='/auth/launch') {
        // Also clear browser credentials on unconfirmed database revocation.
        // A 503 never claims that server sign-out succeeded.
        if(request.headers.get('origin')===origin && request.headers.get('x-checklings-request')==='1') {
          headers.delete('Set-Cookie');for(const value of cleared)headers.append('Set-Cookie',value);
        }
      }
      return reply(status,{error:code});
    }
  };
}

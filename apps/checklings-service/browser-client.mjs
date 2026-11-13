/** Browser-only transport. No tokens, identity or pet state in browser storage. */
export function createGameClient({onClear=()=>{},environment=globalThis}={}) {
  if(typeof environment.BroadcastChannel!=='function') {onClear();throw new Error('Browser session support unavailable');}
  let generation=0,active=true,disposed=false,idleTimer;
  const now=()=>environment.performance?.now?.()??Date.now();
  const schedule=environment.setTimeout?.bind(environment)??setTimeout,cancel=environment.clearTimeout?.bind(environment)??clearTimeout;
  const pending=new Set();
  const channel=new environment.BroadcastChannel('checklings-privacy-v1');
  function clear(announce=true) {
    generation++;active=false;
    cancel(idleTimer);
    for(const controller of pending)controller.abort();
    pending.clear();onClear();
    if(announce)channel?.postMessage('clear');
  }
  const receive=event=>{if(event.data==='clear')clear(false);};
  channel?.addEventListener('message',receive);
  const hide=()=>{if(environment.document?.visibilityState==='hidden')clear(false);};
  const restore=event=>{if(event.persisted)clear(false);};
  environment.document?.addEventListener('visibilitychange',hide);
  environment.addEventListener?.('pageshow',restore);
  async function post(path,body,{privateWork=false,render}={}) {
    if(disposed || (privateWork && !active))return null;
    const started=generation,requestedAt=now(),controller=new AbortController();pending.add(controller);
    try {
      const response=await environment.fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json','X-Checklings-Request':'1'},body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json();
      if(disposed || generation!==started)return null;
      if(!response.ok) {
        if(privateWork || response.status===401)clear();
        throw new Error('Request failed');
      }
      if(privateWork || path==='/auth/exchange') {
        const raw=response.headers.get('X-Checklings-Session-Remaining-Ms'),remaining=Number(raw);
        if(raw===null || !Number.isFinite(remaining) || remaining<=0 || remaining>120000) {clear();throw new Error('Session expired');}
        const budget=remaining-Math.max(0,now()-requestedAt);
        if(budget<=0){clear();return null;}
        cancel(idleTimer);idleTimer=schedule(()=>clear(),budget);
      }
      if(render)render(result);
      return result;
    } catch(error) {
      if(controller.signal.aborted || generation!==started || disposed)return null;
      // Network and body/JSON failures bypass the HTTP-status branch above.
      // Clear every private view and pending read without claiming revocation.
      if(privateWork)clear();
      throw error;
    } finally {pending.delete(controller);}
  }
  return {
    async beginLogin() {
      clear();
      const started=generation;
      const result=await post('/auth/launch',{});
      if(!result || disposed || generation!==started)return false;
      const url=new URL(result.launchUrl);
      if(url.protocol!=='https:' || url.hostname!=='script.google.com' || url.username || url.password || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname))throw new Error('Invalid school launch');
      environment.location.assign(url.href);return true;
    },
    async exchange(input,complete) {clear();return Boolean(await post('/auth/exchange',input,{render:complete}));},
    async logout() {
      clear();
      // Do not attach this revocation request to the cancelled private requests.
      const response=await environment.fetch('/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{'Content-Type':'application/json','X-Checklings-Request':'1'},body:'{}'});
      if(!response.ok)throw new Error('Sign-out could not be confirmed');
    },
    async loadCreature(creatureId,render) {await post('/api/creature',{creatureId},{privateWork:true,render});},
    async rename(commandId,input,render) {await post('/api/rename',{commandId,input},{privateWork:true,render});},
    dispose() {
      clear(false);disposed=true;channel?.removeEventListener('message',receive);channel?.close();
      environment.document?.removeEventListener('visibilitychange',hide);environment.removeEventListener?.('pageshow',restore);
    },
  };
}

// Static, identity-free documents. The host adds a fresh CSP nonce.
export function authPage(kind,nonce) {
  const callback=kind==='callback';
  const script=callback?`
    (async()=>{
      const raw=location.hash;
      history.replaceState(null,'','/auth/callback');
      const status=document.getElementById('status'),done=document.getElementById('done');
      try {
        const params=new URLSearchParams(raw.slice(1));
        if([...params.keys()].length!==3 || !['flowId','state','code'].every(k=>params.getAll(k).length===1 && /^[A-Za-z0-9_-]{43}$/.test(params.get(k))))throw new Error();
        const {createGameClient}=await import('/auth/client.js');
        const client=createGameClient({onClear:()=>{status.textContent='This page was cleared.';}});
        done.disabled=false;
        done.addEventListener('click',async()=>{
          status.textContent='Signing out…';
          try {await client.logout();status.textContent='Signed out.';}
          catch {status.textContent='Sign-out could not be confirmed. Please close this tab.';}
        });
        const completing=client.exchange(Object.fromEntries(params),()=>location.replace('/'));
        status.textContent='Finishing sign-in…';
        await completing;
      } catch {status.textContent='Sign-in did not finish. Please start again.';}
    })();`:`
    (async()=>{
      const {createGameClient}=await import('/auth/client.js');
      const status=document.getElementById('status'),start=document.getElementById('start');
      const client=createGameClient({onClear:()=>{status.textContent='Opening school sign-in…';}});
      start.disabled=false;
      start.addEventListener('click',async()=>{
        start.disabled=true;
        try {await client.beginLogin();}
        catch {status.textContent='School sign-in is unavailable. Please try again.';start.disabled=false;}
      });
    })().catch(()=>{document.getElementById('status').textContent='School sign-in is unavailable. Please try again.';});`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Checklings sign-in</title></head><body><main><h1>Checklings</h1><p id="status" role="status">${callback?'Finishing sign-in…':'Use your school sign-in to open your Checklings.'}</p>${callback?'<button id="done" type="button" disabled>Done / next student</button>':'<button id="start" type="button" disabled>Continue to school sign-in</button>'}<p><a href="/auth/start">Start again</a></p><noscript>JavaScript is needed to sign in.</noscript></main><script nonce="${nonce}">${script}</script></body></html>`;
}

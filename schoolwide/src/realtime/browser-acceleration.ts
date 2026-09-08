import type { FastifyInstance } from 'fastify';

const bootstrap = String.raw`<script data-sw130-realtime>(function(){'use strict';
var tokenKey='grantdesk.schoolwide.staffToken',controller=null,reconnect=null,refreshTimer=null;
function token(){return sessionStorage.getItem(tokenKey)||''}
function focusBusy(){var a=document.activeElement;return !!document.querySelector('dialog[open]')||!!(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))}
function authoritativeRefresh(){if(typeof window.grantDeskRealtimeRefresh!=='function')return;if(focusBusy()){clearTimeout(refreshTimer);refreshTimer=setTimeout(authoritativeRefresh,750);return}Promise.resolve(window.grantDeskRealtimeRefresh()).catch(function(){})}
function streamUrl(){if(location.pathname==='/teacher'){var section=typeof window.grantDeskRealtimeSection==='function'?window.grantDeskRealtimeSection():'';return section?'/api/v1/realtime/teacher/sections/'+encodeURIComponent(section)+'/events':''}if(location.pathname==='/security')return'/api/v1/realtime/security/events';if(location.pathname==='/admin')return'/api/v1/realtime/admin/events';return''}
async function connect(){if(controller)controller.abort();clearTimeout(reconnect);var auth=token(),url=streamUrl();if(!auth||!url){reconnect=setTimeout(connect,5000);return}controller=new AbortController();try{var response=await fetch(url,{headers:{authorization:'Bearer '+auth},cache:'no-store',signal:controller.signal});if(!response.ok||!response.body)throw new Error('stream unavailable');var reader=response.body.getReader(),decoder=new TextDecoder(),buffer='';for(;;){var chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});var split;while((split=buffer.indexOf('\n\n'))>=0){var frame=buffer.slice(0,split);buffer=buffer.slice(split+2);if(frame.indexOf('event: invalidate')>=0){clearTimeout(refreshTimer);refreshTimer=setTimeout(authoritativeRefresh,100)}}}}catch(_error){}finally{if(controller&&!controller.signal.aborted)reconnect=setTimeout(connect,5000)}}
if(location.pathname==='/teacher'){var select=document.getElementById('section-select');if(select)select.addEventListener('change',function(){setTimeout(connect,0)})}
window.addEventListener('storage',function(e){if(e.key===tokenKey)connect()});window.addEventListener('beforeunload',function(){if(controller)controller.abort();clearTimeout(reconnect);clearTimeout(refreshTimer)});setTimeout(connect,0);
})();</script>`;

export function injectRealtimeAcceleration(path: string, html: string): string {
  let transformed = html;
  if (path === '/teacher') {
    transformed = transformed.replace(
      'Live updates currently use bounded polling fallback. Realtime transport is a later operations batch; correctness does not depend on it.',
      'Realtime hints refresh this view when available; bounded polling remains the authoritative fallback.',
    );
    transformed = transformed.replace(
      "byId('section-select').addEventListener('change'",
      "window.grantDeskRealtimeRefresh=function(){return loadLive()};window.grantDeskRealtimeSection=function(){return state.sectionId};byId('section-select').addEventListener('change'",
    );
  } else if (path === '/security') {
    transformed = transformed.replace('setInterval(updateElapsed,1000);', "window.grantDeskRealtimeRefresh=function(){return refresh()};setInterval(updateElapsed,1000);");
  } else if (path === '/admin') {
    transformed = transformed.replace('document.querySelectorAll(\'[role="tab"]\')', "window.grantDeskRealtimeRefresh=function(){return refresh()};document.querySelectorAll('[role=\"tab\"]')");
  } else {
    return html;
  }
  return transformed.replace('</body>', `${bootstrap}</body>`);
}

export function registerRealtimeBrowserAcceleration(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    if (!['/teacher', '/security', '/admin'].includes(request.url.split('?')[0] ?? '')) return payload;
    if (typeof payload !== 'string') return payload;
    reply.header('cache-control', 'no-store');
    return injectRealtimeAcceleration(request.url.split('?')[0] ?? '', payload);
  });
}

export function securityConsoleHtml(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GrantDesk Security</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light;background:#f4f6f8;color:#17202a}*{box-sizing:border-box}body{margin:0;background:#f4f6f8}button,input,select,textarea{font:inherit}button,input,select{min-height:44px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid currentColor;outline-offset:2px}.top{position:sticky;top:0;z-index:5;background:#17202a;color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{font-weight:800;letter-spacing:.02em}.status{font-size:.9rem}.wrap{max-width:1500px;margin:0 auto;padding:20px}.notice{padding:12px 14px;border:1px solid #aab4be;background:#fff;border-radius:10px;margin-bottom:16px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.metric,.panel{background:#fff;border:1px solid #d6dde3;border-radius:12px}.metric{padding:16px}.metric strong{display:block;font-size:1.8rem}.panel{padding:16px;margin-bottom:16px}h1,h2{margin-top:0}.filters{display:grid;grid-template-columns:2fr repeat(4,minmax(150px,1fr)) auto;gap:10px;align-items:end}.field{display:flex;flex-direction:column;gap:5px}.field label{font-weight:650;font-size:.9rem}.field input,.field select,.field textarea{border:1px solid #9da9b3;border-radius:8px;padding:9px 10px;background:#fff}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid #59636d;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}.btn.primary{background:#17202a;color:#fff;border-color:#17202a}.btn:disabled{opacity:.55;cursor:not-allowed}.table-wrap{overflow:auto}.movement{width:100%;border-collapse:collapse;min-width:960px}.movement th,.movement td{text-align:left;padding:10px;border-bottom:1px solid #e1e6ea;vertical-align:top}.movement th{font-size:.82rem;text-transform:uppercase;letter-spacing:.04em}.warning{font-weight:700}.warning[data-state="LATE"]::before{content:"Late — "}.warning[data-state="STALE"]::before{content:"Stale — "}.warning[data-state="UNCONFIGURED"]::before{content:"Threshold unavailable — "}.muted{color:#5e6872}.empty{padding:24px;text-align:center;color:#5e6872}.search-results{display:grid;gap:8px;margin-top:12px}.search-card{border:1px solid #d6dde3;border-radius:9px;padding:10px}.queue{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}.queue-item{border:1px solid #d6dde3;border-radius:9px;padding:10px}dialog{border:0;border-radius:12px;max-width:520px;width:calc(100% - 32px);box-shadow:0 20px 60px rgba(0,0,0,.25)}dialog::backdrop{background:rgba(0,0,0,.45)}dialog form{display:grid;gap:12px}textarea{min-height:110px;resize:vertical}.dialog-actions{display:flex;justify-content:flex-end;gap:8px}.sr-status{min-height:1.4em;margin-top:8px}@media(max-width:1100px){.filters{grid-template-columns:1fr 1fr 1fr}.filters .wide{grid-column:1/-1}}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 1fr}.filters .wide{grid-column:1/-1}}@media(max-width:520px){.wrap{padding:12px}.metrics{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}.filters .wide{grid-column:auto}.top{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<header class="top"><div class="brand">GrantDesk · Security</div><div id="connectionStatus" class="status">Staff session required</div></header>
<main class="wrap">
  <div class="notice" id="scopeNotice">This console shows immediate school movement only. It does not expose PINs, credentials, private exception reasons, attendance history, Classroom details, or teacher/admin configuration.</div>
  <section class="metrics" aria-label="Live movement summary">
    <div class="metric"><span>Students out</span><strong id="outCount">—</strong></div>
    <div class="metric"><span>Waiting</span><strong id="waitingCount">—</strong></div>
    <div class="metric"><span>Late</span><strong id="lateCount">—</strong></div>
    <div class="metric"><span>Stale</span><strong id="staleCount">—</strong></div>
  </section>

  <section class="panel" aria-labelledby="movementHeading">
    <h1 id="movementHeading">Live movement</h1>
    <div class="filters" aria-label="Movement filters">
      <div class="field wide"><label for="studentSearch">Student lookup</label><input id="studentSearch" autocomplete="off" placeholder="Name or student number"></div>
      <div class="field"><label for="destinationFilter">Destination</label><select id="destinationFilter"><option value="">All destinations</option></select></div>
      <div class="field"><label for="teacherFilter">Teacher</label><select id="teacherFilter"><option value="">All teachers</option></select></div>
      <div class="field"><label for="warningFilter">Warning</label><select id="warningFilter"><option value="">All states</option><option value="NONE">No warning</option><option value="LATE">Late</option><option value="STALE">Stale</option><option value="UNCONFIGURED">Threshold unavailable</option></select></div>
      <div class="field"><label for="sectionFilter">Section ID</label><input id="sectionFilter" autocomplete="off" placeholder="Optional exact section ID"></div>
      <button class="btn primary" id="refreshButton" type="button">Refresh</button>
    </div>
    <div id="liveStatus" class="sr-status" role="status" aria-live="polite"></div>
    <div class="table-wrap" id="movementContainer"><div class="empty">Connect a staff session to load live movement.</div></div>
  </section>

  <section class="panel" aria-labelledby="queueHeading"><h2 id="queueHeading">Waiting queue</h2><div id="queueContainer" class="queue"><div class="empty">No queue data loaded.</div></div></section>
  <section class="panel" aria-labelledby="searchHeading"><h2 id="searchHeading">Student lookup results</h2><div id="searchResults" class="search-results"><div class="empty">Enter at least two characters above.</div></div></section>
</main>

<dialog id="actionDialog" aria-labelledby="actionTitle">
  <form method="dialog" id="actionForm">
    <h2 id="actionTitle">Security action</h2>
    <p id="actionDescription"></p>
    <div class="field"><label for="actionReason">Private operational note</label><textarea id="actionReason" maxlength="1000" required></textarea></div>
    <div class="dialog-actions"><button class="btn" value="cancel" id="cancelAction">Cancel</button><button class="btn primary" value="default" id="confirmAction">Record action</button></div>
    <div id="dialogStatus" role="status" aria-live="polite"></div>
  </form>
</dialog>
<script>
(function(){
  'use strict';
  var storageKey='grantdesk.schoolwide.staffToken';
  var token=sessionStorage.getItem(storageKey)||'';
  var pollTimer=null;
  var pollAfterMs=5000;
  var pendingAction=null;
  var returnFocus=null;
  var els={
    connection:document.getElementById('connectionStatus'),out:document.getElementById('outCount'),waiting:document.getElementById('waitingCount'),late:document.getElementById('lateCount'),stale:document.getElementById('staleCount'),
    status:document.getElementById('liveStatus'),movement:document.getElementById('movementContainer'),queue:document.getElementById('queueContainer'),search:document.getElementById('studentSearch'),searchResults:document.getElementById('searchResults'),destination:document.getElementById('destinationFilter'),teacher:document.getElementById('teacherFilter'),warning:document.getElementById('warningFilter'),section:document.getElementById('sectionFilter'),refresh:document.getElementById('refreshButton'),dialog:document.getElementById('actionDialog'),dialogTitle:document.getElementById('actionTitle'),dialogDescription:document.getElementById('actionDescription'),reason:document.getElementById('actionReason'),dialogStatus:document.getElementById('dialogStatus'),confirm:document.getElementById('confirmAction')
  };

  function headers(extra){var h={authorization:'Bearer '+token};if(extra){Object.keys(extra).forEach(function(k){h[k]=extra[k];});}return h;}
  function text(tag,value,className){var n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;}
  function duration(ms){var minutes=Math.floor(ms/60000);var seconds=Math.floor((ms%60000)/1000);return minutes+'m '+String(seconds).padStart(2,'0')+'s';}
  function requestId(){return crypto.randomUUID();}
  async function api(url,options){options=options||{};options.headers=headers(options.headers||{});var res=await fetch(url,options);var body={};try{body=await res.json();}catch(e){}if(res.status===401){token='';sessionStorage.removeItem(storageKey);setConnection();}if(!res.ok){var err=new Error(body.message||('Request failed ('+res.status+')'));err.code=body.code||'REQUEST_FAILED';throw err;}return body;}
  function setConnection(){els.connection.textContent=token?'Security session connected':'Staff session required';if(!token){clearTimeout(pollTimer);}}
  function queryString(){var p=new URLSearchParams();if(els.destination.value)p.set('destinationId',els.destination.value);if(els.teacher.value)p.set('teacherUserId',els.teacher.value);if(els.warning.value)p.set('warning',els.warning.value);var section=els.section.value.trim();if(section)p.set('sectionId',section);var s=p.toString();return s?'?'+s:'';}
  function safeRender(fn){var active=document.activeElement;if(active&&els.movement.contains(active)){return false;}fn();return true;}
  function renderDestinations(items){var current=els.destination.value;while(els.destination.options.length>1)els.destination.remove(1);items.forEach(function(item){var o=document.createElement('option');o.value=item.destinationId;o.textContent=item.name;els.destination.appendChild(o);});els.destination.value=current;}
  function renderTeachers(passes){var current=els.teacher.value;var known={};for(var i=1;i<els.teacher.options.length;i++){known[els.teacher.options[i].value]=els.teacher.options[i].textContent;}passes.forEach(function(pass){if(pass.sourceTeacher)known[pass.sourceTeacher.userId]=pass.sourceTeacher.displayName;});if(!current){while(els.teacher.options.length>1)els.teacher.remove(1);}Object.keys(known).sort(function(a,b){return String(known[a]).localeCompare(String(known[b]));}).forEach(function(id){if(Array.from(els.teacher.options).some(function(o){return o.value===id;}))return;var o=document.createElement('option');o.value=id;o.textContent=known[id];els.teacher.appendChild(o);});els.teacher.value=current;}
  function warningLabel(state){if(state==='LATE')return 'Late';if(state==='STALE')return 'Stale';if(state==='UNCONFIGURED')return 'No configured threshold';return 'On time';}
  function actionButton(label,kind,pass){var b=text('button',label,'btn');b.type='button';b.addEventListener('click',function(){openAction(kind,pass,b);});return b;}
  function renderMovement(board){
    els.out.textContent=String(board.summary.out);els.waiting.textContent=String(board.summary.waiting);els.late.textContent=String(board.summary.late);els.stale.textContent=String(board.summary.stale);renderDestinations(board.destinations||[]);renderTeachers(board.passes||[]);
    safeRender(function(){
      els.movement.replaceChildren();
      if(!board.passes.length){els.movement.appendChild(text('div','No active passes match the current filters.','empty'));return;}
      var table=document.createElement('table');table.className='movement';var thead=document.createElement('thead');var tr=document.createElement('tr');['Student','Source','Destination','Out','Elapsed','Warning','Latest Security action','Actions'].forEach(function(v){tr.appendChild(text('th',v));});thead.appendChild(tr);table.appendChild(thead);var tbody=document.createElement('tbody');
      board.passes.forEach(function(pass){var row=document.createElement('tr');row.appendChild(text('td',pass.studentName));var source=(pass.sectionName+(pass.room?' · '+pass.room:'')+(pass.sourceTeacher?' · '+pass.sourceTeacher.displayName:''));row.appendChild(text('td',source));row.appendChild(text('td',pass.destinationName));row.appendChild(text('td',new Date(pass.startedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})));row.appendChild(text('td',duration(pass.elapsedMs)));var w=text('td',warningLabel(pass.warningState),'warning');w.dataset.state=pass.warningState;row.appendChild(w);row.appendChild(text('td',pass.latestOperationalAction?(pass.latestOperationalAction.kind==='MARK_LOCATED'?'Located':'Return requested')+' · '+new Date(pass.latestOperationalAction.occurredAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—'));var actions=document.createElement('td');var box=document.createElement('div');box.className='actions';box.appendChild(actionButton('Mark located','MARK_LOCATED',pass));box.appendChild(actionButton('Request return','REQUEST_RETURN',pass));actions.appendChild(box);row.appendChild(actions);tbody.appendChild(row);});table.appendChild(tbody);els.movement.appendChild(table);
    });
    els.queue.replaceChildren();if(!board.waiting.length){els.queue.appendChild(text('div','No students are waiting.','empty'));}else{board.waiting.forEach(function(item){var card=document.createElement('div');card.className='queue-item';card.appendChild(text('strong',item.studentName));card.appendChild(text('div',item.sectionName+(item.room?' · '+item.room:''),'muted'));card.appendChild(text('div',item.destinationName+' · waiting '+duration(item.waitingMs)));els.queue.appendChild(card);});}
    if(board.warningPolicy.status==='UNCONFIGURED'){els.status.textContent='Live movement refreshed. Late/stale thresholds are not currently proven by school policy, so those rows are labeled threshold unavailable.';}else{els.status.textContent='Live movement refreshed at '+new Date(board.generatedAt).toLocaleTimeString()+'.';}
  }
  async function refresh(){if(!token){setConnection();return;}try{var board=await api('/api/v1/security/live-passes'+queryString());pollAfterMs=board.transport&&board.transport.pollAfterMs||5000;renderMovement(board);setConnection();}catch(e){els.status.textContent=e.message;}finally{clearTimeout(pollTimer);if(token)pollTimer=setTimeout(refresh,pollAfterMs);}}
  async function search(){var q=els.search.value.trim();if(q.length<2){els.searchResults.replaceChildren(text('div','Enter at least two characters.','empty'));return;}try{var data=await api('/api/v1/security/students/search?q='+encodeURIComponent(q)+'&limit=20');els.searchResults.replaceChildren();if(!data.results.length){els.searchResults.appendChild(text('div','No matching students.','empty'));return;}data.results.forEach(function(r){var card=document.createElement('div');card.className='search-card';card.appendChild(text('strong',r.studentName));var detail=r.localStudentNumber?'Student '+r.localStudentNumber:'Student';if(r.currentState.kind==='OUT')detail+=' · OUT to '+r.currentState.destinationName;else if(r.currentState.kind==='WAITING')detail+=' · WAITING for '+r.currentState.destinationName;else detail+=' · no current pass/queue state';card.appendChild(text('div',detail,'muted'));els.searchResults.appendChild(card);});}catch(e){els.searchResults.replaceChildren(text('div',e.message,'empty'));}}
  function openAction(kind,pass,button){pendingAction={kind:kind,pass:pass};returnFocus=button;els.dialogTitle.textContent=kind==='MARK_LOCATED'?'Mark student located':'Request student return';els.dialogDescription.textContent=kind==='MARK_LOCATED'?'Record that '+pass.studentName+' was located. This does not close the pass.':'Record a return request for '+pass.studentName+'. This does not close the pass.';els.reason.value='';els.dialogStatus.textContent='';els.dialog.showModal();setTimeout(function(){els.reason.focus();},0);}
  async function performAction(){if(!pendingAction)return;var reason=els.reason.value.trim();if(!reason){els.dialogStatus.textContent='A private operational note is required.';els.reason.focus();return;}els.confirm.disabled=true;try{var path=pendingAction.kind==='MARK_LOCATED'?'/located':'/request-return';await api('/api/v1/security/passes/'+encodeURIComponent(pendingAction.pass.passId)+path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':requestId()},body:JSON.stringify({reason:reason})});els.dialog.close();els.status.textContent=pendingAction.kind==='MARK_LOCATED'?'Student marked located. Pass remains active.':'Return requested. Pass remains active until an authorized return occurs.';pendingAction=null;await refresh();}catch(e){els.dialogStatus.textContent=e.message;}finally{els.confirm.disabled=false;}}
  els.refresh.addEventListener('click',refresh);els.destination.addEventListener('change',refresh);els.teacher.addEventListener('change',refresh);els.warning.addEventListener('change',refresh);els.section.addEventListener('change',refresh);els.search.addEventListener('input',function(){clearTimeout(els.search._timer);els.search._timer=setTimeout(search,250);});els.confirm.addEventListener('click',function(ev){ev.preventDefault();performAction();});els.dialog.addEventListener('close',function(){if(returnFocus&&document.contains(returnFocus))returnFocus.focus();returnFocus=null;});
  window.grantDeskSecuritySession=function(value){token=String(value||'').trim();if(token)sessionStorage.setItem(storageKey,token);else sessionStorage.removeItem(storageKey);setConnection();refresh();};
  setConnection();if(token)refresh();
})();
</script>
</body>
</html>`;
}

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let key = '';
  try { key = sessionStorage.getItem('checkaverse-teacher') || ''; } catch { /* private mode */ }
  let paused = false, noSchool = false, timer = 0;

  async function api(path, body) {
    const res = await fetch(`/api/teacher/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-Teacher-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) throw new Error('key');
    if (!res.ok) throw new Error(data.msg || 'Something went wrong.');
    return data;
  }
  const status = (t, bad) => { $('status').textContent = t; $('status').classList.toggle('down', Boolean(bad)); };

  function render(state) {
    paused = state.paused;
    $('pause').textContent = paused ? 'Resume the Checkaverse' : 'Pause the Checkaverse';
    $('pauseState').textContent = paused ? 'Paused. Nobody can walk, talk or challenge.' : 'Running.';
    noSchool = Boolean(state.noSchool);
    $('noSchool').textContent = noSchool ? 'Undo: there was school today' : 'No school today';
    $('noSchoolState').textContent = noSchool ? 'Checkling body clocks skip today, like a snow day.' : 'Body clocks count today as a school day if the calendar does.';
    if (Date.now() > holdStatus) status(`Live · ${state.players.length} trainer${state.players.length === 1 ? '' : 's'} · server ${state.version}`);
    const list = $('list');
    list.textContent = '';
    // Alphabetical, so the teacher can find a trainer fast in a class of thirty.
    for (const p of [...state.players].sort((a, b) => a.name.localeCompare(b.name))) {
      const tr = document.createElement('tr');
      for (const v of [p.name + (p.busy ? ' (Busy)' : ''), p.hour || '', p.room, p.minutes, p.phrases, p.challenges]) {
        const td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      }
      const td = document.createElement('td');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ghost'; b.textContent = 'Remove';
      b.addEventListener('click', async () => {
        if (!confirm(`Remove ${p.name} from the Checkaverse?`)) return;
        try { await api('remove', { id: p.id }); refresh(); } catch (e) { status(e.message, true); }
      });
      td.appendChild(b); tr.appendChild(td); list.appendChild(tr);
    }
  }

  let holdStatus = 0; // keeps "Message sent." up past the 3 second refresh
  async function refresh() {
    try {
      render(await api('state'));
    } catch (e) {
      if (e.message === 'key') { $('controls').hidden = true; $('login').hidden = false; clearInterval(timer); return status('That key did not work.', true); }
      status('Cannot reach the Checkaverse right now.', true);
    }
  }

  async function start() {
    try {
      render(await api('state'));
      try { sessionStorage.setItem('checkaverse-teacher', key); } catch { /* ignore */ }
      $('login').hidden = true; $('controls').hidden = false;
      clearInterval(timer); timer = setInterval(refresh, 3000);
    } catch (e) {
      status(e.message === 'key' ? 'That key did not work.' : 'Cannot reach the Checkaverse right now.', true);
    }
  }

  $('login').addEventListener('submit', (e) => { e.preventDefault(); key = $('key').value.trim(); start(); });
  $('pause').addEventListener('click', async () => { try { await api('pause', { v: !paused }); refresh(); } catch (e) { status(e.message, true); } });
  $('noSchool').addEventListener('click', async () => { try { await api('noschool', { v: !noSchool }); refresh(); } catch (e) { status(e.message, true); } });
  $('say').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('msg').value.trim();
    if (!msg) return;
    try { await api('say', { msg }); $('msg').value = ''; status('Message sent.'); holdStatus = Date.now() + 5000; } catch (err) { status(err.message, true); }
  });
  if (key) start();
})();

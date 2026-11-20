/*
 * Medal of Honor project · the workspace.
 * desk-save.js owns signing in and saving every answer box. This file adds the
 * project team on top: it asks Turn In which team the signed in student is on,
 * shows that student's own boxes as editable and the partner's boxes as read
 * only, and keeps the steps, progress and next job obvious.
 */
(function () {
  'use strict';
  var M = window.MOH, VETS = window.MOH_VETERANS || [], HUB = M.HUB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var FIELD = {}; M.FIELDS.forEach(function (f) { FIELD[f.id] = f; });
  var S = { account: null, team: null, taken: [], role: null, partner: null, partnerAt: 0, step: 'facts', setupMode: '', picked: '', busy: false, designer: null, demo: false };
  var pollTimer = 0;

  /* The student sees short, concrete instructions instead of a wall of directions.
   * Guidance never supplies an answer, and the role-specific fields remain separate.
   */
  var GUIDE = {
    facts: ['Open his page in a new tab.', 'Look for the early-life or service record section.', 'Write each fact as one short sentence. Use your own words.'],
    words: ['Read the official Medal of Honor citation below.', 'Choose three highlighted hard words for YOUR side.', 'Explain each word like you are teaching someone younger.'],
    story1: ['Read the matching chapter on his page.', 'Answer the three questions in order. Each box becomes part of your report.', 'Write 2 or 3 short sentences in each box.'],
    story2: ['Read the next section on his page or the numbered citation part.', 'Explain what happened in your own words.', 'Write 2 or 3 short sentences per box.'],
    why: ['Choose one real moment from his story.', 'Explain why it stood out to YOU.', 'Explain what his story teaches us about courage or America during World War I.'],
    art: ['Poster Lead: make a hand-drawn wall poster. Screen Lead: create your digital memorial.', 'Complete the short planning boxes first.', 'Finish the artwork, then mark it done. Your partner makes their own piece.'],
    finish: ['Use the checklist to find anything missing.', 'Read the full report. Fix anything that needs work.', 'Press Turn In on your own account. Both partners turn in separately.']
  };
  function fieldTip(f) {
    if (f.kind === 'word') return 'Choose a word from the citation above. You can click a highlighted word.';
    if (f.kind === 'meaning') return 'Use a simple explanation, not just the same word again.';
    if (f.kind === 'why') return 'Start with what YOU noticed, then explain why you think it matters.';
    if (f.kind === 'box' && f.chapter === 'cite') return 'Read the numbered part of the citation above this box. Tell what it means in everyday language.';
    if (f.kind === 'box' && f.chapter === 'before') return 'Find this detail in the Before the War section of his page.';
    if (f.kind === 'box' && f.chapter === 'day') return 'Use the Day He Earned the Medal section. Include the people, place or actions involved.';
    if (f.kind === 'box' && f.chapter === 'after') return 'Find this in the After the War section. Include a specific fact.';
    if (f.id.indexOf('quote') !== -1) return 'Use 12 words or fewer, copied exactly from the official citation.';
    if (f.kind === 'fact') return f.owner === 'a'
      ? 'Find this in his early-life story or service record. Use one short sentence.'
      : 'Find this in his service record, battle story or After the War section.';
    if (f.kind === 'short') return 'Use a short, specific sentence. Your veteran page has the facts you need.';
    return '';
  }
  function installGuides() {
    var mode = $('#stage-mode .cards2');
    if (mode) mode.parentNode.insertBefore(el('p', { class: 'setup-guide' },
      'Working with a partner? Sit together and decide who will draw the poster (Partner A) and who will make the digital screen (Partner B). Partner A starts the team. Partner B signs in with THEIR OWN PIN on THEIR OWN Chromebook and enters the team code.'), mode);
    var join = $('#stage-join .join-row');
    if (join) join.parentNode.insertBefore(el('p', { class: 'setup-guide' },
      'Ask your partner for the four-character code on their screen. Do not enter their lunch PIN. You must both be in the same class period.'), join);
    var coach = el('p', { id: 'ws-coach', class: 'ws-coach', 'aria-live': 'off' });
    var progress = $('#ws-progress');
    if (progress) {
      var track = progress.parentNode;
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-label', 'Your project progress');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', '0');
      track.parentNode.insertBefore(coach, track.nextSibling);
    }
    $('.ws-step').forEach(function (step) {
      var info = GUIDE[step.getAttribute('data-step')], intro = $('.step-intro', step);
      if (!info || !intro) return;
      var panel = el('div', { class: 'step-guide' }), title = el('strong', {}, 'Do these next:'), list = el('ol');
      info.forEach(function (tip) { list.appendChild(el('li', {}, tip)); });
      panel.appendChild(title); panel.appendChild(list);
      intro.parentNode.insertBefore(panel, intro.nextSibling);
    });
    M.FIELDS.forEach(function (f) {
      if (f.kind === 'gen') return;
      var input = document.getElementById(f.id), box = input && input.closest('.box'), hint = fieldTip(f);
      if (!box || !hint) return;
      var note = el('p', { class: 'box-guide', id: 'guide-' + f.id }, hint);
      input.parentNode.insertBefore(note, input);
      input.setAttribute('aria-describedby', note.id);
      input.setAttribute('autocapitalize', 'sentences');
      input.setAttribute('autocorrect', 'on');
      if (input.tagName === 'TEXTAREA') {
        var foot = $('.box-foot', box);
        if (foot) {
          var count = el('span', { class: 'moh-wordcount', 'aria-live': 'off' });
          var update = function () {
            var n = (input.value.trim().match(/\S+/g) || []).length;
            count.textContent = n + (n === 1 ? ' word' : ' words');
          };
          input.addEventListener('input', update);
          foot.insertBefore(count, foot.firstChild);
          update();
        }
        var expand = el('button', { type: 'button', class: 'moh-expand', 'aria-expanded': 'false', 'aria-controls': input.id }, 'Make box bigger');
        expand.addEventListener('click', function () {
          var big = box.classList.toggle('big-writing');
          expand.setAttribute('aria-expanded', String(big));
          expand.textContent = big ? 'Normal size' : 'Make box bigger';
          input.focus();
        });
        box.appendChild(expand);
      }
    });
  }
  function updateCoach() {
    if (!S.team) return;
    var now = M.STEPS.find(function (st) { return st.id === S.step; }), c = stepCounts(S.step);
    var wait = S.team.mode === 'pair' && S.role === 'A' && !names().hasB;
    var who = S.role === 'solo' ? 'Working alone: both parts are yours.'
      : S.role === 'A' ? 'You are Partner A (the poster).' : 'You are Partner B (the memorial screen).';
    var message = 'Step ' + (now ? now.n : 1) + ' of 7 · ' + c.done + ' of ' + c.total + ' of YOUR boxes done. ' + who
      + ' Gold boxes are yours; dashed boxes belong to your partner.';
    if (wait) message += ' Your partner has not joined yet. Give them code ' + S.team.code + '. You can start your own boxes now.';
    if (S.team.mode === 'pair' && names().hasB) message += ' You both use your own PIN and Turn In separately.';
    var coach = $('#ws-coach');
    if (coach) coach.textContent = message;
    var track = $('#ws-progress') && $('#ws-progress').parentNode;
    if (track) track.setAttribute('aria-valuenow', String(Math.round(parseFloat($('#ws-progress').style.width) || 0)));
  }


  function el(tag, attrs, text) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; return n; }
  function vet(slug) { return VETS.find(function (v) { return v.slug === slug; }) || null; }
  function toast(text) { var t = el('div', { class: 'toast', role: 'status' }, text); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function show(id) { ['moh-wait', 'moh-setup', 'moh-work'].forEach(function (x) { $('#' + x).hidden = x !== id; }); }

  // A mistake in this page's own code still shows up as a page error, so tests catch it.
  function bug(e) { if (e && !e.code && !e.network) setTimeout(function () { throw e; }); }

  /* ------------------------------------------------------------ network -- */
  function api(op, extra) {
    var acc = window.__deskSave && window.__deskSave.account && window.__deskSave.account();
    if (!acc) return Promise.reject(new Error('Sign in with your PIN first.'));
    var body = Object.assign({ action: 'team', op: op, token: acc.token, hub: HUB, course: 'ush9', classPeriod: acc.classPeriod, device: acc.device }, extra || {});
    var tries = 0;
    function once() {
      return fetch(acc.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (data) {
          if (data && data.ok) return data;
          var e = new Error(data && data.error || 'That did not go through. Press the button again.'); e.code = data && data.code; throw e;
        })
        .catch(function (e) {
          if (!e.code && tries++ < 2) return new Promise(function (res) { setTimeout(res, 1500 * tries); }).then(once);
          if (!e.code) { e.network = true; e.message = 'The project server did not answer. Check the WiFi and press the button again.'; }
          throw e;
        });
    }
    return once();
  }

  /* ---------------------------------------------------------------- setup -- */
  function setupMsg(text, good) { var m = $('#setup-msg'); m.hidden = !text; m.textContent = text || ''; m.className = 'msg' + (good ? ' good' : ''); }
  function stage(name) {
    ['mode', 'join', 'pick'].forEach(function (s) { $('#stage-' + s).hidden = s !== name; });
    var title = $('#setup-title');
    var titles = {
      mode: 'How are you working?',
      join: 'Join your partner',
      pick: S.setupMode === 'change' ? 'Change your veteran' : 'Choose your veteran'
    };
    title.textContent = titles[name];
    $('#setup-hello').hidden = name !== 'mode';
    setupMsg('');
    title.focus();
  }
  function enterSetup(mode) {
    show('moh-setup');
    var acc = window.__deskSave.account();
    $('#setup-hello').textContent = 'Hi ' + (acc && acc.firstName || 'there') + '. Choose one. If you are working with a partner, only one of you starts the team.';
    S.setupMode = mode || '';
    if (mode === 'change') { buildPicker(); stage('pick'); }
    else stage('mode');
  }
  function buildPicker() {
    var grid = $('#pick-grid'); grid.innerHTML = '';
    var want = new URLSearchParams(location.search).get('pick');
    if (!S.picked && vet(want) && S.taken.indexOf(want) < 0) S.picked = want;
    if (S.setupMode === 'change' && S.team) S.picked = S.team.choice;
    VETS.forEach(function (v) {
      var taken = S.taken.indexOf(v.slug) >= 0;
      var card = el('button', { type: 'button', class: 'vcard' + (taken ? ' taken' : '') + (S.picked === v.slug ? ' picked' : ''), 'data-slug': v.slug, 'aria-pressed': S.picked === v.slug ? 'true' : 'false' });
      if (taken) card.disabled = true;
      card.appendChild(window.MOH_PORTRAITS.image(v.slug, 'thumb'));
      card.appendChild(el('span', { class: 'rank' }, v.rank + ' · ' + v.branch));
      card.appendChild(el('span', { class: 'name' }, v.name));
      if (taken) card.appendChild(el('span', { class: 'choice-status' }, 'Taken in your class'));
      var entry = el('div', { class: 'picker-entry' });
      entry.appendChild(card);
      entry.appendChild(el('a', {
        href: '/hubs/ush9-medal-of-honor-veteran.html?v=' + v.slug,
        target: '_blank', rel: 'noopener', class: 'tag', 'aria-label': 'Read about ' + v.name + ' (new tab)'
      }, 'Read profile ↗'));
      card.addEventListener('click', function () {
        S.picked = v.slug;
        $$('#pick-grid .vcard').forEach(function (c) {
          var on = c.getAttribute('data-slug') === v.slug;
          c.classList.toggle('picked', on);
          c.setAttribute('aria-pressed', String(on));
        });
        $('[data-action="confirm-pick"]').disabled = false;
      });
      grid.appendChild(entry);
    });
    $('[data-action="confirm-pick"]').disabled = !S.picked || S.taken.indexOf(S.picked) >= 0;
  }
  function confirmPick() {
    if (!S.picked || S.busy) return;
    S.busy = true; setupMsg('Saving your choice…', true);
    var p = S.setupMode === 'change' ? api('choose', { choice: S.picked }) : api('create', { mode: S.setupMode === 'solo' ? 'solo' : 'pair', choice: S.picked });
    p.then(function (r) { S.taken = r.taken || []; enterWork(r.team); if (S.setupMode === 'change') toast('Veteran changed to ' + vet(r.team.choice).name + '.'); })
      .catch(function (e) { bug(e); setupMsg(e.message); if (e.code === 'taken') return api('status').then(function (r) { S.taken = r.taken || []; S.picked = ''; buildPicker(); setupMsg(e.message); }); })
      .finally(function () { S.busy = false; });
  }
  function joinTeam() {
    var code = $('#join-code').value.trim().toUpperCase();
    if (code.length !== 4) { setupMsg('Team codes have four letters or numbers. Ask your partner to read it to you.'); return; }
    if (S.busy) return; S.busy = true; setupMsg('Joining…', true);
    api('join', { code: code }).then(function (r) { S.taken = r.taken || []; enterWork(r.team); toast('You joined the team. You are Partner B, the Screen Lead.'); })
      .catch(function (e) { bug(e); setupMsg(e.message); }).finally(function () { S.busy = false; });
  }

  /* --------------------------------------------------------------- roles -- */
  function names() {
    var t = S.team, a = t.members.find(function (m) { return m.role === 'A' || m.role === 'solo'; }), b = t.members.find(function (m) { return m.role === 'B'; });
    return { a: a ? a.name : 'Partner A', b: b ? b.name : 'Partner B', hasB: Boolean(b) };
  }
  function partnerName() { var n = names(); return S.role === 'A' ? (n.hasB ? n.b : 'Your partner') : n.a; }
  function owned(id) { return S.role ? M.owns(S.role, FIELD[id]) : false; }
  function hiddenForSolo(f) { return S.role === 'solo' && f.owner === 'b' && f.kind === 'why'; }
  function applyRole() {
    document.body.classList.remove('role-a', 'role-b', 'role-solo', 'role-none', 'mode-solo', 'mode-pair');
    document.body.classList.add('role-' + String(S.role).toLowerCase(), 'mode-' + S.team.mode);
    $$('.box[data-field]').forEach(function (box) {
      var id = box.getAttribute('data-field'), f = FIELD[id], input = document.getElementById(id), mine = owned(id), skip = hiddenForSolo(f);
      box.classList.toggle('partner', !mine && !skip);
      if (f.kind !== 'gen') box.hidden = skip;
      input.readOnly = !mine || f.kind === 'gen';
      if (mine) input.removeAttribute('data-desk-uncounted'); else input.setAttribute('data-desk-uncounted', '');
      var view = $('.partner-view', box); if (view) view.hidden = mine || skip;
    });
    $$('.group').forEach(function (g) {
      var o = g.getAttribute('data-group'), step = g.closest('.ws-step').getAttribute('data-step');
      var mine = S.role === 'solo' ? true : o === String(S.role).toLowerCase();
      var skip = S.role === 'solo' && o === 'b' && step === 'why';
      g.classList.toggle('mine', mine && !skip); g.classList.toggle('theirs', !mine); g.classList.toggle('skip', skip);
      $('.badge', g).textContent = S.role === 'solo' ? (o === 'a' ? 'Your job · part A' : 'Your job · part B') : mine ? 'Your job' : partnerName() + '’s job';
    });
    renderPartner();
  }

  /* ------------------------------------------------------------- partner -- */
  function renderPartner() {
    var answers = {};
    (S.partner && S.partner.answers || []).forEach(function (e) { answers[e.k.replace(/^id:/, '')] = e.a; });
    $$('.box.partner').forEach(function (box) {
      var id = box.getAttribute('data-field'), view = $('.partner-view', box), text = String(answers[id] || '').trim();
      if (!view) return;
      view.textContent = text || (S.team.mode === 'pair' && !names().hasB ? 'Your partner has not joined yet.' : 'Not written yet.');
      view.classList.toggle('empty', !text);
    });
    // the partner's art piece, read only
    $$('.theirs-art').forEach(function (n) { n.remove(); });
    var artGroup = $('.ws-step[data-step="art"] .group.theirs');
    if (artGroup && S.role === 'A' && answers['moh-b-screen-data']) {
      var img = el('img', { class: 'theirs-art', alt: partnerName() + '’s memorial screen so far', style: 'margin-top:1rem;border-radius:.5rem;width:100%' });
      img.src = window.MOHArt.image(answers['moh-b-screen-data'], screenTexts(answers));
      artGroup.appendChild(img);
    }
    var chip = $('#ws-partner-chip');
    if (chip) {
      var at = S.partner && S.partner.savedAt ? new Date(S.partner.savedAt) : null;
      chip.querySelector('span').textContent = at ? partnerName() + ' last saved ' + ago(at) : partnerName() + ' has not saved anything yet';
      chip.classList.toggle('fresh', Boolean(at && Date.now() - at < 5 * 60000));
    }
    refreshProgress();
  }
  function ago(d) {
    var m = Math.round((Date.now() - d) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' hr ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function pollPartner() {
    clearTimeout(pollTimer);
    if (!S.team || S.demo) return;
    // Check often while a new team waits for the partner to type the code, then settle down.
    var waiting = S.team.mode === 'pair' && !names().hasB;
    var wait = document.visibilityState !== 'visible' ? 180000 : waiting ? 12000 : 75000;
    var signedAt = window.__deskSave && window.__deskSave.account && window.__deskSave.account();
    var teamId = S.team.id;
    pollTimer = setTimeout(function () {
      api('status').then(function (r) {
        var signedNow = window.__deskSave && window.__deskSave.account && window.__deskSave.account();
        if (!S.team || S.team.id !== teamId || !signedAt || !signedNow || signedAt.token !== signedNow.token) return;
        if (!r.team) { leaveWork(); enterSetup(); return; }
        var joined = S.team && S.team.mode === 'pair' && !names().hasB && r.team.members.length > 1;
        S.team = r.team; S.partner = r.team.partner; S.taken = r.taken || [];
        if (r.team.choice !== currentVet().slug) { enterWork(r.team); toast('Your team changed veterans to ' + vet(r.team.choice).name + '.'); return; }
        headLine(); renderPartner();
        if (joined) toast(partnerName() + ' joined your team.');
      }).catch(function () { /* try again next time */ }).then(pollPartner);
    }, wait);
  }

  /* ------------------------------------------------------------ the work -- */
  function currentVet() { return vet(S.team.choice) || VETS[0]; }
  function headLine() {
    var v = currentVet(), n = names(), line = $('#ws-team'); line.innerHTML = '';
    $('#ws-avatar').replaceChildren(window.MOH_PORTRAITS.image(v.slug, 'thumb'));
    $('#ws-vet').textContent = v.name;
    $('#ws-vet-link').href = '/hubs/ush9-medal-of-honor-veteran.html?v=' + v.slug;
    if (S.team.mode === 'solo') {
      line.appendChild(el('span', {}, 'Working alone · '));
      line.appendChild(el('strong', {}, n.a)); line.appendChild(el('span', {}, ' · you do every job · ' + S.team.classPeriod));
    } else {
      line.appendChild(el('span', {}, 'Partner A, Poster Lead: ')); line.appendChild(el('strong', {}, n.a + (S.role === 'A' ? ', that is you' : '')));
      line.appendChild(el('span', {}, ' · Partner B, Screen Lead: ')); line.appendChild(el('strong', {}, n.hasB ? n.b + (S.role === 'B' ? ', that is you' : '') : 'waiting'));
      if (S.team.code) line.appendChild(el('span', {}, ' · Team code ')), line.appendChild(el('strong', { style: 'letter-spacing:.2em;color:var(--bronze2)' }, S.team.code));
      var chip = el('span', { class: 'partner-chip', id: 'ws-partner-chip', style: 'margin-left:.6rem' }); chip.appendChild(el('i')); chip.appendChild(el('span'));
      line.appendChild(chip);
    }
    var acts = $('.ws-actions');
    $$('[data-extra]', acts).forEach(function (b) { b.remove(); });
    if (!S.demo) {
      var change = el('button', { type: 'button', class: 'btn ghost small', 'data-extra': '', 'data-action': 'change' }, 'Change veteran');
      acts.insertBefore(change, acts.firstChild);
      if (S.team.mode === 'solo' || !n.hasB) acts.insertBefore(el('button', { type: 'button', class: 'btn ghost small', 'data-extra': '', 'data-action': 'start-over' }, 'Start over'), acts.firstChild);
    }
  }
  function screenTexts(source) {
    var v = currentVet(), get = function (id) { return source ? String(source[id] || '').trim() : String((document.getElementById(id) || {}).value || '').trim(); };
    return { name: v.name, rank: v.rank, date: v.actionLabel, place: v.place, title: get('moh-b-screen-title'), caption: get('moh-b-screen-caption'), quote: get('moh-b-screen-quote') };
  }
  function fillVeteranParts() {
    var v = currentVet(), parts = M.citationParts(v.citation);
    $$('.cite-part').forEach(function (q) { q.textContent = parts[Number(q.getAttribute('data-part'))] || ''; });
    var full = $('.full-cite'); full.innerHTML = '';
    var words = v.words.map(function (w) { return w[0]; }), re = new RegExp('\\b(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'gi'), last = 0, m;
    while ((m = re.exec(v.citation))) { full.appendChild(document.createTextNode(v.citation.slice(last, m.index))); full.appendChild(el('mark', {}, m[0])); last = m.index + m[0].length; }
    full.appendChild(document.createTextNode(v.citation.slice(last)));
    var chips = $('.word-chips'); chips.innerHTML = '';
    v.words.forEach(function (w) {
      var b = el('button', { type: 'button' }, w[0]);
      b.addEventListener('click', function () {
        var target = $$('.box.k-word').map(function (box) { return document.getElementById(box.getAttribute('data-field')); }).filter(function (i) { return owned(i.id) && !i.value.trim(); })[0];
        if (!target) { toast('Your word boxes are full. Delete one to use a different word.'); return; }
        target.value = w[0]; target.dispatchEvent(new Event('input', { bubbles: true }));
        var meaning = document.getElementById(target.id.replace('-word-', '-mean-')); if (meaning) meaning.focus();
      });
      chips.appendChild(b);
    });
  }
  function initDesigner() {
    var host = $('.designer'), data = document.getElementById('moh-b-screen-data');
    if (!owned('moh-b-screen-data')) { host.innerHTML = ''; S.designer = null; return; }
    S.designer = window.MOHArt.designer(host, {
      value: data.value,
      texts: function () { return screenTexts(); },
      onChange: function (json) { data.value = json; data.dispatchEvent(new Event('input', { bubbles: true })); refreshProgress(); }
    });
    ['moh-b-screen-title', 'moh-b-screen-caption', 'moh-b-screen-quote'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { if (S.designer) S.designer.refresh(); }); });
  }
  function syncChoices() {
    $$('.choice[data-target]').forEach(function (c) {
      var v = document.getElementById(c.getAttribute('data-target')).value;
      $$('button', c).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-value') === v ? 'true' : 'false'); });
    });
  }

  /* -------------------------------------------------------------- meters -- */
  function meter(box) {
    var id = box.getAttribute('data-field'), f = FIELD[id], input = document.getElementById(id), m = $('.meter', box);
    var ok = M.done(f, input.value); box.classList.toggle('ok', ok);
    if (!m) return ok;
    var left = f.min - input.value.trim().length;
    m.textContent = !owned(id) ? '' : ok ? 'Done ✓' : !input.value.trim() ? '' : f.min <= 20 ? 'Add a little more' : 'Add about ' + Math.max(1, Math.ceil(left / 5)) + ' more words';
    return ok;
  }
  function stepCounts(stepId) {
    var list = M.FIELDS.filter(function (f) { return f.step === stepId && owned(f.id); });
    var done = list.filter(function (f) { return M.done(f, document.getElementById(f.id).value); }).length;
    return { done: done, total: list.length };
  }
  function partnerCounts(stepId) {
    var answers = {}; (S.partner && S.partner.answers || []).forEach(function (e) { answers[e.k.replace(/^id:/, '')] = e.a; });
    var role = S.role === 'A' ? 'B' : 'A';
    var list = M.FIELDS.filter(function (f) { return f.step === stepId && M.owns(role, f); });
    return { done: list.filter(function (f) { return M.done(f, answers[f.id]); }).length, total: list.length };
  }
  function refreshProgress() {
    if (!S.team) return;
    $$('.box[data-field]').forEach(meter);
    var all = 0, done = 0;
    M.STEPS.forEach(function (s) {
      var c = stepCounts(s.id), btn = $('.ws-steps [data-goto="' + s.id + '"]');
      all += c.total; done += c.done;
      if (s.id === 'finish') { btn.querySelector('.st').textContent = ''; return; }
      btn.classList.toggle('done', c.total > 0 && c.done === c.total);
      btn.querySelector('.st').textContent = c.total ? c.done + '/' + c.total : '';
    });
    $('#ws-progress').style.width = (all ? Math.round(done / all * 100) : 0) + '%';
    checklist();
    syncChoices();
    updateCoach();
  }
  function checklist() {
    var ul = $('#moh-checklist'); ul.innerHTML = '';
    M.STEPS.filter(function (s) { return s.id !== 'finish'; }).forEach(function (s) {
      var c = stepCounts(s.id); if (!c.total) return;
      var li = el('li', { class: c.done === c.total ? 'ok' : '' });
      var b = el('button', { type: 'button' }, 'Step ' + s.n + ', ' + s.short); b.addEventListener('click', function () { go(s.id); });
      li.appendChild(b); li.appendChild(el('span', {}, ' · ' + c.done + ' of ' + c.total + ' done'));
      ul.appendChild(li);
    });
    var pl = $('#moh-partner-checklist'); pl.innerHTML = '';
    if (S.team.mode === 'solo') return;
    if (S.role === 'A' && !names().hasB) { pl.appendChild(el('li', {}, 'Your partner has not joined yet. Give them the code ' + S.team.code + '.')); return; }
    M.STEPS.filter(function (s) { return s.id !== 'finish'; }).forEach(function (s) {
      var c = partnerCounts(s.id); if (!c.total) return;
      pl.appendChild(el('li', { class: c.done === c.total ? 'ok' : '' }, 'Step ' + s.n + ', ' + s.short + ' · ' + c.done + ' of ' + c.total));
    });
  }

  /* ---------------------------------------------------------- navigation -- */
  function go(stepId, focusId) {
    S.step = stepId;
    $$('.ws-step').forEach(function (s) { s.hidden = s.getAttribute('data-step') !== stepId; });
    $$('.ws-steps [data-goto]').forEach(function (b) { if (b.getAttribute('data-goto') === stepId) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    try { sessionStorage.setItem('moh-step', stepId); } catch (e) { /* fine */ }
    if (stepId === 'art' && S.designer) S.designer.refresh();
    updateCoach();
    var target = focusId && document.getElementById(focusId);
    if (target) {
      var box = target.closest('.box'); box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
      box.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true });
    } else {
      var top = $('#step-' + stepId); window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - 170) });
      $('h2', top).setAttribute('tabindex', '-1'); $('h2', top).focus({ preventScroll: true });
    }
  }
  function nextJob() {
    for (var i = 0; i < M.STEPS.length; i++) {
      var s = M.STEPS[i];
      var f = M.FIELDS.find(function (x) { return x.step === s.id && owned(x.id) && !M.done(x, document.getElementById(x.id).value); });
      if (!f) continue;
      if (f.kind === 'gen') {
        go(s.id);
        var target = f.id === 'moh-b-screen-data' ? $('.designer') : $('.choice[data-target="' + f.id + '"]');
        if (target) { target.scrollIntoView({ block: 'center' }); toast(f.id === 'moh-b-screen-data' ? 'Next job: draw your memorial screen.' : f.id === 'moh-a-poster-layout' ? 'Next job: pick a poster layout.' : 'Next job: finish your poster, then mark it Done.'); }
        return;
      }
      go(s.id, f.id); return;
    }
    go('finish'); toast('All your jobs are done. Look over the paper and press Turn In.');
  }

  /* ------------------------------------------------------------- preview -- */
  function mergedValues() {
    var mine = {}, theirs = {};
    M.FIELDS.forEach(function (f) { mine[f.id] = document.getElementById(f.id).value; });
    (S.partner && S.partner.answers || []).forEach(function (e) { theirs[e.k.replace(/^id:/, '')] = e.a; });
    var out = {};
    M.FIELDS.forEach(function (f) { out[f.id] = S.role === 'solo' || owned(f.id) ? mine[f.id] : (theirs[f.id] || ''); });
    return out;
  }
  function openOverlay(node) {
    var body = $('#preview-body'); body.innerHTML = ''; body.appendChild(node);
    $('#moh-preview').hidden = false; document.body.classList.add('previewing'); $('[data-action="close-preview"]').focus();
  }
  function closeOverlay() { $('#moh-preview').hidden = true; document.body.classList.remove('previewing'); }
  function preview() {
    var n = names();
    openOverlay(window.MOHPaper.build(currentVet(), { mode: S.team.mode, a: n.a, b: n.hasB ? n.b : 'Partner B', classPeriod: S.team.classPeriod }, mergedValues(), { showMissing: true }));
  }
  function blueprint() { openOverlay(window.MOHPaper.blueprint(currentVet(), mergedValues(), names().a)); }

  /* --------------------------------------------------------------- enter -- */
  function enterWork(team) {
    S.team = team; S.partner = team.partner || null; S.role = team.role;
    show('moh-work');
    headLine(); applyRole(); fillVeteranParts(); initDesigner();
    var saved = ''; try { saved = sessionStorage.getItem('moh-step') || ''; } catch (e) { /* fine */ }
    go(M.STEPS.some(function (s) { return s.id === saved; }) ? saved : 'facts');
    refreshProgress();
    pollPartner();
  }
  function leaveWork() {
    clearTimeout(pollTimer);
    S.team = null; S.partner = null; S.role = null; S.picked = ''; S.demo = false;
    document.body.className = 'role-none';
  }
  function load() {
    show('moh-wait');
    $('#moh-wait p').textContent = 'Opening your project…';
    api('status').then(function (r) {
      S.taken = r.taken || [];
      if (r.team) enterWork(r.team); else enterSetup();
    }).catch(function (e) {
      bug(e);
      $('#moh-wait p').textContent = e.message + ' ';
      var retry = el('button', { type: 'button', class: 'btn small' }, 'Try again'); retry.addEventListener('click', load); $('#moh-wait p').appendChild(retry);
    });
  }

  /* -------------------------------------------------------------- events -- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action],[data-mode],[data-goto],.choice button');
    if (!t) return;
    if (t.matches('.choice button')) {
      var c = t.closest('.choice'), input = document.getElementById(c.getAttribute('data-target'));
      if (!owned(input.id)) return;
      input.value = t.getAttribute('data-value'); input.dispatchEvent(new Event('input', { bubbles: true })); refreshProgress(); return;
    }
    if (t.hasAttribute('data-goto')) { go(t.getAttribute('data-goto')); return; }
    if (t.hasAttribute('data-mode')) {
      var mode = t.getAttribute('data-mode');
      if (mode === 'join') { stage('join'); $('#join-code').focus(); return; }
      S.setupMode = mode === 'solo' ? 'solo' : 'pair'; buildPicker(); stage('pick'); return;
    }
    var a = t.getAttribute('data-action');
    if (a === 'help') { e.preventDefault(); $('#moh-help').hidden = false; $('[data-action="close-help"]').focus(); }
    else if (a === 'close-help') $('#moh-help').hidden = true;
    else if (a === 'back-mode') { if (S.setupMode === 'change' && S.team) { show('moh-work'); return; } stage('mode'); }
    else if (a === 'confirm-pick') confirmPick();
    else if (a === 'join') joinTeam();
    else if (a === 'next-job') nextJob();
    else if (a === 'next' || a === 'prev') { var i = M.STEPS.findIndex(function (s) { return s.id === S.step; }), j = Math.max(0, Math.min(M.STEPS.length - 1, i + (a === 'next' ? 1 : -1))); go(M.STEPS[j].id); }
    else if (a === 'preview') preview();
    else if (a === 'blueprint') blueprint();
    else if (a === 'close-preview') closeOverlay();
    else if (a === 'print') window.print();
    else if (a === 'change') { if (window.confirm('Change your veteran? Your writing stays, but you will need to fix anything that was about the old veteran.')) enterSetup('change'); }
    else if (a === 'start-over') {
      if (!window.confirm('Start over? This cancels your team setup. Your typed answers stay in your account.')) return;
      api('cancel').then(function (r) { S.taken = r.taken || []; leaveWork(); enterSetup(); }).catch(function (err) { toast(err.message); });
    }
  });
  document.addEventListener('input', function (e) { if (S.team && e.target.closest && e.target.closest('.box')) { meter(e.target.closest('.box')); clearTimeout(S.refreshTimer); S.refreshTimer = setTimeout(refreshProgress, 400); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('#moh-preview').hidden) closeOverlay(); else if (!$('#moh-help').hidden) $('#moh-help').hidden = true;
  });
  $('#join-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinTeam(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.team) pollPartner(); });
  window.addEventListener('desk-save:account', function () { if (!S.team) load(); });
  window.addEventListener('desk-save:reset', function () { leaveWork(); show('moh-wait'); $('#moh-wait p').textContent = 'Sign in with your lunch PIN to open your project.'; });

  installGuides();

  // A teacher device skips the PIN gate. Offer a read through of every step.
  // While the paper or blueprint is open, printing prints only that, page after page.
  var style = el('style', {}, '@media print{.toast{display:none!important}body.previewing{background:#fff}body.previewing>*:not(#moh-preview){display:none!important}body.previewing #moh-preview{position:static;inset:auto;background:#fff;padding:0;overflow:visible}body.previewing #moh-preview .bar{display:none!important}}');
  document.head.appendChild(style);
  setTimeout(function () {
    if (S.team || (window.__deskSave && window.__deskSave.account && window.__deskSave.account())) return;
    var gate = document.getElementById('desk-save-gate');
    if (gate && !gate.hidden) return;
    var p = $('#moh-wait p'); p.textContent = 'Teacher preview. Students sign in here with their lunch PIN. ';
    var b = el('button', { type: 'button', class: 'btn small' }, 'Preview every step'); p.appendChild(b);
    b.addEventListener('click', function () { S.demo = true; enterWork({ mode: 'solo', role: 'solo', choice: VETS[0].slug, classPeriod: 'Preview', members: [{ role: 'solo', name: 'Preview', me: true }], partner: null }); });
  }, 2500);
})();

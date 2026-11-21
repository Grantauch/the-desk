// 1 v 1. Two players hold their own road on the same battlefield. Złoty buys guns for your road or
// units for your opponent's road, and every unit you send raises your income. The play server only
// pairs players and passes messages. Each Chromebook runs its own battle.
(function (root) {
  const BK = root.BK;
  const app = BK.app;
  const UP = BK.UI.prototype;
  const G = BK.Game.prototype;
  const $ = (id) => document.getElementById(id);

  const GAME = "blitzkrieg";
  // The game tries its own address first, then the same server through margin.grant-desk.com.
  const SERVERS = (() => {
    const q = new URLSearchParams(location.search).get("play");
    if (q && /^wss?:\/\//.test(q)) return [q];
    return ["wss://play.grant-desk.com/ws", "wss://margin.grant-desk.com/play/ws"];
  })();
  let serverAt = 0;
  const INCOME_EVERY = 6; // seconds
  const BASE_INCOME = 6;
  const FIRST_WAVE_IN = 25;
  const BETWEEN_WAVES = 15;
  const CARD_TIME = 12;
  const SEND_COOLDOWN = 0.9;
  const OVERTIME_AT = 8 * 60; // after this, every column gets tougher each minute so a match always ends
  const OVERTIME_RAMP = 1.2;

  // What you can send down the other road. Wave is the wave you must have reached first.
  const SENDS = [
    { id: "squad", one: "rifleman", many: "riflemen", kind: "inf", n: 6, gap: 0.35, cost: 30, eco: 1, wave: 1, label: "Rifle squad" },
    { id: "moto", one: "motorcycle", many: "motorcycles", kind: "moto", n: 3, gap: 0.55, cost: 45, eco: 2, wave: 1, label: "Motorcycles" },
    { id: "truck", one: "supply truck", many: "supply trucks", kind: "truck", n: 2, gap: 1.1, cost: 60, eco: 3, wave: 2, label: "Supply trucks" },
    { id: "armcar", one: "armored car", many: "armored cars", kind: "armcar", n: 2, gap: 1, cost: 90, eco: 4, wave: 3, label: "Armored cars" },
    { id: "htrack", one: "half track", many: "half tracks", kind: "htrack", n: 2, gap: 1.2, cost: 110, eco: 5, wave: 4, label: "Half tracks" },
    { id: "stuka", one: "Stuka", many: "Stukas", kind: "stuka", n: 2, gap: 1.5, cost: 140, eco: 6, wave: 5, label: "Stukas", air: true },
    { id: "ltank", one: "light tank", many: "light tanks", kind: "ltank", n: 2, gap: 1.4, cost: 150, eco: 7, wave: 6, label: "Light tanks" },
    { id: "mtank", one: "Panzer IV", many: "Panzer IVs", kind: "mtank", n: 1, gap: 1, cost: 230, eco: 10, wave: 8, label: "Panzer IV" },
    { id: "command", one: "command tank", many: "command tanks", kind: "command", n: 1, gap: 1, cost: 520, eco: 22, wave: 11, label: "Command tank" },
  ];
  const SEND_BY_ID = Object.fromEntries(SENDS.map((s) => [s.id, s]));

  // ------------------------------------------------------------------ connection
  class Net {
    constructor(onMsg, onDrop) {
      this.onMsg = onMsg;
      this.onDrop = onDrop;
      this.ws = null;
    }
    async open() {
      for (let k = 0; k < SERVERS.length; k++) {
        const i = (serverAt + k) % SERVERS.length;
        try { await this.openOne(SERVERS[i]); serverAt = i; return; } catch (e) { /* try the next address */ }
      }
      throw new Error("unreachable");
    }
    openOne(url) {
      return new Promise((ok, no) => {
        let done = false;
        let ws;
        try { ws = new WebSocket(url); } catch (e) { no(e); return; }
        const timer = setTimeout(() => { if (!done) { done = true; try { ws.close(); } catch (e) { /* closing */ } no(new Error("timeout")); } }, 8000);
        ws.onopen = () => { if (done) return; done = true; clearTimeout(timer); this.ws = ws; ok(); };
        ws.onerror = () => { if (done) return; done = true; clearTimeout(timer); no(new Error("refused")); };
        ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.onMsg(m); };
        ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.onDrop(); } };
      });
    }
    send(m) {
      if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; }
      return false;
    }
    close() {
      const ws = this.ws;
      this.ws = null;
      if (ws) try { ws.close(); } catch (e) { /* already closed */ }
    }
  }

  // ------------------------------------------------------------------ lobby markup
  function buildLobby() {
    if ($("versus")) return;
    const play = $("b-play");
    const b = document.createElement("button");
    b.id = "b-versus";
    b.innerHTML = `<span class="vs-mark">1 v 1</span> Battle a classmate`;
    play.after(b);
    b.onclick = () => { BK.Audio.unlock(); BK.Audio.ui(); openLobby(); };

    const el = document.createElement("div");
    el.id = "versus";
    el.className = "screen hidden";
    el.innerHTML = `
      <div class="vs-lobby">
        <div class="kicker">Two commanders</div>
        <h2>1 v 1</h2>
        <p class="vs-how">You each hold your own road on the same battlefield. Spend złoty on guns to stop what comes at you, or on units to send down your opponent's road. Every unit you send raises your income. The first garrison to fall loses.</p>
        <div class="menu vs-menu">
          <button class="big" id="vs-quick">Quick match</button>
          <button id="vs-create">Make a room</button>
          <form class="vs-join" id="vs-join-form" autocomplete="off">
            <label for="vs-code">Room code</label>
            <input id="vs-code" maxlength="4" spellcheck="false" autocapitalize="characters">
            <button type="submit" id="vs-join">Join</button>
          </form>
        </div>
        <div id="vs-status" class="vs-status" role="status" aria-live="polite"></div>
        <button class="back" id="vs-back">Back</button>
      </div>`;
    $("title").after(el);
    $("vs-quick").onclick = () => findMatch("quick");
    $("vs-create").onclick = () => findMatch("create");
    $("vs-join-form").onsubmit = (e) => { e.preventDefault(); findMatch("join"); };
    $("vs-code").oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); };
    $("vs-back").onclick = () => { BK.Audio.ui(); cancelLobby(); app.ui.screen("title"); };
  }

  function lobbyStatus(html, busy) {
    const s = $("vs-status");
    s.innerHTML = html || "";
    s.classList.toggle("busy", !!busy);
    for (const id of ["vs-quick", "vs-create", "vs-join"]) $(id).disabled = !!busy;
  }

  function openLobby() {
    app.ui.screen("versus");
    lobbyStatus("");
  }

  // ------------------------------------------------------------------ match state
  let lobby = null; // a connection waiting for an opponent
  let vs = null; // the match in progress

  function cancelLobby() {
    if (lobby) { lobby.net.send({ t: "leave" }); lobby.net.close(); lobby = null; }
    lobbyStatus("");
  }

  async function findMatch(how) {
    if (lobby || vs) return;
    BK.Audio.unlock();
    BK.Audio.ui();
    const code = $("vs-code").value.trim();
    if (how === "join" && code.length !== 4) { lobbyStatus("Type the four letter code from your opponent's screen."); return; }
    lobbyStatus("Reaching the battle server", true);
    const me = { net: null };
    lobby = me;
    me.net = new Net((m) => onLobbyMsg(me, m), () => {
      if (lobby === me) { lobby = null; lobbyStatus("Lost the connection to the battle server. Try again."); }
    });
    try {
      await me.net.open();
    } catch (e) {
      if (lobby === me) lobby = null;
      lobbyStatus("Can't reach the battle server from this network. Try again, or tell your teacher.");
      return;
    }
    if (lobby !== me) { me.net.close(); return; }
    if (how === "quick") me.net.send({ t: "quick", game: GAME });
    else if (how === "create") me.net.send({ t: "create", game: GAME });
    else me.net.send({ t: "join", game: GAME, code });
  }

  function onLobbyMsg(me, m) {
    if (lobby !== me) return;
    if (m.t === "waiting") {
      if (m.code) lobbyStatus(`<span>Give your opponent this code</span><b class="vs-code">${m.code}</b><span>Waiting for them to join</span><button id="vs-cancel" class="vs-cancel">Cancel</button>`, true);
      else lobbyStatus(`<span>Looking for an opponent</span><button id="vs-cancel" class="vs-cancel">Cancel</button>`, true);
      const c = $("vs-cancel");
      if (c) c.onclick = () => { BK.Audio.ui(); cancelLobby(); };
    } else if (m.t === "error") {
      me.net.close();
      lobby = null;
      lobbyStatus(m.msg);
    } else if (m.t === "start") {
      lobby = null;
      beginMatch(me.net, m);
    }
  }

  function beginMatch(net, m) {
    vs = {
      net, code: m.code, token: m.token, side: m.side, map: m.map, seed: m.seed,
      eco: 0, ecoT: 0, stateT: 0, cardT: 0, cool: {}, incoming: [], sent: 0, sentValue: 0, earned: 0,
      opp: { gar: null, wave: 0, eco: 0 }, oppAway: 0, ended: false, why: "", reconnecting: false,
    };
    net.onMsg = onMatchMsg;
    net.onDrop = onMatchDrop;
    app.ui.screen("none");
    app.startRun(m.map, true, { versus: vs });
  }

  function onMatchMsg(m) {
    if (!vs) return;
    if (m.t === "relay" && m.d) onRelay(m.d);
    else if (m.t === "away") { vs.oppAway = m.seconds || 30; app.ui.toast("Opponent dropped", "Their Chromebook lost the connection. They have 30 seconds to get back.", null, 0, 5); }
    else if (m.t === "back") { vs.oppAway = 0; app.ui.toast("Opponent is back", "The battle goes on.", null, 0, 3); }
    else if (m.t === "rejoined") { vs.reconnecting = false; setLink(""); }
    else if (m.t === "gone") { endMatch(false, "lost connection"); }
    else if (m.t === "end") endMatch(m.win, m.why);
  }

  function onMatchDrop() {
    if (!vs || vs.ended) return;
    vs.reconnecting = true;
    setLink("Reconnecting to the battle server");
    const started = performance.now();
    const tryAgain = async () => {
      if (!vs || vs.ended || !vs.reconnecting) return;
      if (performance.now() - started > 28000) { endMatch(false, "lost connection"); return; }
      try {
        await vs.net.open();
        vs.net.send({ t: "rejoin", code: vs.code, token: vs.token });
      } catch (e) {
        setTimeout(tryAgain, 2000);
      }
    };
    setTimeout(tryAgain, 600);
  }

  function setLink(text) {
    const el = $("vs-link");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("hidden", !text);
  }

  function relay(d) { return vs && vs.net.send({ t: "relay", d }); }

  // ------------------------------------------------------------------ sending units
  function trySend(id) {
    const g = app.g, s = SEND_BY_ID[id];
    if (!vs || vs.ended || !g || g.result || !s) return;
    if (Math.max(1, g.wave) < s.wave) { BK.Audio.ui("deny"); app.ui.toast("Not yet", `${s.label} unlock at wave ${s.wave}.`, null, 0, 2); return; }
    if ((vs.cool[id] || 0) > 0) return;
    if (g.money < s.cost) { BK.Audio.ui("deny"); return; }
    if (!relay({ k: "send", u: id })) { BK.Audio.ui("deny"); return; }
    g.money -= s.cost;
    vs.eco += s.eco;
    vs.sent += s.n;
    vs.sentValue += s.cost;
    vs.cool[id] = SEND_COOLDOWN;
    BK.Audio.ui();
    const b = document.querySelector(`#vs-sends [data-send="${id}"]`);
    if (b) { b.classList.remove("fired"); void b.offsetWidth; b.classList.add("fired"); }
  }

  function onRelay(d) {
    const g = app.g;
    if (!g || g.result) return;
    if (d.k === "send" && SEND_BY_ID[d.u]) receive(g, SEND_BY_ID[d.u]);
    else if (d.k === "state") {
      vs.opp.gar = Number(d.gar) || 0;
      vs.opp.wave = Number(d.wave) || 0;
      vs.opp.eco = Number(d.eco) || 0;
      vs.oppAway = 0;
    }
  }

  function receive(g, s) {
    const items = [];
    const nPaths = g.paths.length;
    const path = s.air ? "air" : (g.vsPathFlip = ((g.vsPathFlip || 0) + 1)) % nPaths;
    const squad = s.kind === "inf" ? 900000 + (g.vsSquad = (g.vsSquad || 0) + 1) : 0;
    for (let i = 0; i < s.n; i++) {
      items.push({
        dt: i * s.gap, kind: s.kind, path, squad,
        lat: s.kind === "inf" ? ((i % 3) - 1) * 12 + g.rng.range(-3, 3) : 0,
      });
    }
    if (g.phase === "combat") {
      for (const q of items) g.queue.push({ t: g.waveT + 0.4 + q.dt, kind: q.kind, path: q.path, squad: q.squad, lat: q.lat });
      g.queue.sort((a, b) => a.t - b.t);
    } else {
      g.vsIncoming = g.vsIncoming || [];
      for (const q of items) g.vsIncoming.push(q);
    }
    incomingToast(s);
  }

  // Group toasts so a burst of sends reads as one warning.
  let toastPend = null;
  function incomingToast(s) {
    if (!toastPend) {
      toastPend = {};
      setTimeout(() => {
        const p = toastPend;
        toastPend = null;
        const parts = Object.keys(p).map((id) => { const s = SEND_BY_ID[id], n = p[id] * s.n; return `${n} ${n > 1 ? s.many : s.one}`; });
        const first = SEND_BY_ID[Object.keys(p)[0]];
        const wait = app.g && app.g.phase !== "combat" ? " They hit your road when the next wave starts." : "";
        if (app.ui && parts.length) app.ui.toast("Incoming", parts.join(", ") + "." + wait, BK.Art.enemyIcon(first.kind, 40), 0, 4);
        if (BK.Audio.radio) BK.Audio.radio();
      }, 350);
    }
    toastPend[s.id] = (toastPend[s.id] || 0) + 1;
  }

  // ------------------------------------------------------------------ battle HUD
  const iconCache = {};
  function buildBar() {
    let bar = $("vs-bar");
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.id = "vs-bar";
    let sends = "";
    for (const s of SENDS) {
      if (!iconCache[s.kind]) iconCache[s.kind] = BK.Art.enemyIcon(s.kind, 40);
      sends += `<button data-send="${s.id}" title="Send ${s.n} ${s.n > 1 ? s.many : s.one}. Costs ${s.cost} zł and raises your income by ${s.eco}."><img alt="" src="${iconCache[s.kind]}"><span class="sn">${s.label}</span><span class="sc">${s.cost}</span><span class="se">+${s.eco}</span><span class="sl">Wave ${s.wave}</span></button>`;
    }
    bar.innerHTML = `
      <div class="vs-opp" id="vs-opp">
        <span class="vs-tag">VS</span>
        <span class="vs-o-gar"><b id="vs-o-gar">20</b><small>garrison</small></span>
        <span class="vs-o-wave"><b id="vs-o-wave">1</b><small>wave</small></span>
        <span class="vs-o-away hidden" id="vs-o-away">Reconnecting</span>
      </div>
      <div class="vs-income" title="You earn this much every ${INCOME_EVERY} seconds. Sending units raises it.">
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(239,230,207,0.18)" stroke-width="4"/><circle id="vs-ring" cx="18" cy="18" r="15" fill="none" stroke="#ffcf4a" stroke-width="4" stroke-dasharray="94.2" stroke-dashoffset="94.2" transform="rotate(-90 18 18)"/></svg>
        <span><b id="vs-inc">+${BASE_INCOME}</b><small>income</small></span>
      </div>
      <div class="vs-sends" id="vs-sends" role="group" aria-label="Send units to your opponent">${sends}</div>
      <button class="vs-quit" id="vs-quit">Surrender</button>
      <div class="vs-link hidden" id="vs-link"></div>`;
    $("hud").appendChild(bar);
    bar.querySelectorAll("[data-send]").forEach((b) => (b.onclick = () => trySend(b.dataset.send)));
    const q = $("vs-quit");
    q.onclick = () => {
      if (q.classList.contains("arm")) { relay({ k: "bye" }); vs.net.send({ t: "leave" }); endMatch(false, "surrendered"); return; }
      q.classList.add("arm");
      q.textContent = "Click again to surrender";
      setTimeout(() => { q.classList.remove("arm"); q.textContent = "Surrender"; }, 3000);
    };
    document.body.classList.add("vs-on");
  }

  function frameBar(dt) {
    const g = app.g;
    if (!vs || !g) return;
    for (const id in vs.cool) vs.cool[id] = Math.max(0, vs.cool[id] - dt);
    const reached = Math.max(1, g.wave);
    for (const s of SENDS) {
      const b = document.querySelector(`#vs-sends [data-send="${s.id}"]`);
      if (!b) continue;
      const locked = reached < s.wave;
      b.classList.toggle("locked", locked);
      b.classList.toggle("poor", !locked && g.money < s.cost);
      b.classList.toggle("cool", (vs.cool[s.id] || 0) > 0);
      b.disabled = !!g.result || vs.ended;
    }
    $("vs-inc").textContent = "+" + (BASE_INCOME + vs.eco);
    $("vs-ring").setAttribute("stroke-dashoffset", (94.2 * (1 - vs.ecoT / INCOME_EVERY)).toFixed(1));
    if (vs.opp.gar != null) $("vs-o-gar").textContent = vs.opp.gar;
    $("vs-o-wave").textContent = Math.max(1, vs.opp.wave);
    $("vs-opp").classList.toggle("hurt", vs.opp.gar != null && vs.opp.gar <= 6);
    $("vs-o-away").classList.toggle("hidden", !(vs.oppAway > 0));
  }

  // ------------------------------------------------------------------ hooks into the game
  const baseStartRun = app.startRun;
  app.startRun = function (mapIndex, endless, opts) {
    const v = opts && opts.versus;
    if (!v) {
      if (vs) quitMatch();
      return baseStartRun.call(this, mapIndex, endless, opts);
    }
    // Both players start even: no Command unlocks, regular difficulty, clear weather, same battlefield.
    const S = BK.Save.data, keepUnlocks = S.unlocks, keepClear = BK.RunSave.clear;
    S.unlocks = {};
    BK.RunSave.clear = () => {};
    try {
      baseStartRun.call(this, mapIndex, true, { seed: v.seed, weather: "clear", diff: "regular" });
    } finally {
      S.unlocks = keepUnlocks;
      BK.RunSave.clear = keepClear;
    }
    this.lastOpts = null;
    const g = this.g;
    g.vs = true;
    g.vsIncoming = [];
    g.earlyT = FIRST_WAVE_IN;
    this.speed = 1;
    $("v-speed").textContent = "1x";
    buildBar();
    this.ui.banner("1 v 1", `First wave in ${FIRST_WAVE_IN} seconds. Build fast.`, "streak");
  };

  const baseToTitle = app.toTitle;
  app.toTitle = function () {
    if (vs) quitMatch();
    return baseToTitle.apply(this, arguments);
  };

  const basePause = app.togglePause;
  app.togglePause = function (force) {
    if (vs) return; // a 1 v 1 never stops
    return basePause.call(this, force);
  };
  const baseSpeed = app.toggleSpeed;
  app.toggleSpeed = function () {
    if (vs) return;
    return baseSpeed.call(this);
  };

  const baseWrite = BK.RunSave.write;
  BK.RunSave.write = function (g) {
    if (g && g.vs) return false;
    return baseWrite.call(this, g);
  };

  const baseBrief = UP.showBriefing;
  UP.showBriefing = function () {
    if (vs) return;
    return baseBrief.apply(this, arguments);
  };

  const baseStartWave = G.startWave;
  G.startWave = function () {
    const ok = baseStartWave.call(this);
    if (ok && this.vs && this.vsIncoming && this.vsIncoming.length) {
      for (const q of this.vsIncoming) this.queue.push({ t: 1 + q.dt, kind: q.kind, path: q.path, squad: q.squad, lat: q.lat });
      this.vsIncoming = [];
      this.queue.sort((a, b) => a.t - b.t);
    }
    return ok;
  };

  const baseHp = G.hpScale;
  G.hpScale = function () {
    const base = baseHp.call(this);
    if (!this.vs || !(this.vsClock > OVERTIME_AT)) return base;
    return base * Math.pow(OVERTIME_RAMP, (this.vsClock - OVERTIME_AT) / 60);
  };

  const baseTake = G.takeCard;
  G.takeCard = function (card, silent) {
    const r = baseTake.call(this, card, silent);
    if (this.vs && !silent && this.phase === "deploy") this.earlyT = Math.min(this.earlyT, BETWEEN_WAVES);
    return r;
  };

  const baseEnd = G.endRun;
  G.endRun = function (won) {
    const first = !this.result;
    const r = baseEnd.call(this, won);
    if (first && this.vs && !won && vs && !vs.ended) {
      vs.net.send({ t: "lost" });
      vs.why = "overrun";
    }
    return r;
  };

  const baseFrame = UP.frame;
  UP.frame = function (dt) {
    baseFrame.call(this, dt);
    const g = this.g;
    if (!vs || !g || !g.vs || g.result) { frameBar(dt); return; }
    const before = g.vsClock || 0;
    g.vsClock = before + dt;
    if (before < OVERTIME_AT && g.vsClock >= OVERTIME_AT) {
      this.banner("Overtime", "Every column gets tougher from here on.", "boss");
      if (BK.Audio.radio) BK.Audio.radio();
    }
    // Income arrives on a clock, even while cards are on screen.
    vs.ecoT += dt;
    if (vs.ecoT >= INCOME_EVERY) {
      vs.ecoT -= INCOME_EVERY;
      const n = BASE_INCOME + vs.eco;
      g.money += n;
      vs.earned += n;
      const m = $("st-money");
      if (m) { m.classList.remove("bump"); void m.offsetWidth; m.classList.add("bump"); }
    }
    // A card left on screen gets picked for you.
    if (g.phase === "cards" && g.offer && g.offer.length) {
      vs.cardT += dt;
      if (vs.cardT >= CARD_TIME && !this.picking) {
        const el = document.querySelector("#card-row .card");
        this.pickCard(g.offer[0], el);
      }
    } else vs.cardT = 0;
    if (vs.oppAway > 0) vs.oppAway = Math.max(0, vs.oppAway - dt);
    vs.stateT -= dt;
    if (vs.stateT <= 0) {
      vs.stateT = 1;
      relay({ k: "state", gar: g.garrison, wave: g.wave, eco: vs.eco });
    }
    frameBar(dt);
  };

  // ------------------------------------------------------------------ the end
  function endMatch(won, why) {
    if (!vs || vs.ended) return;
    vs.ended = true;
    vs.won = !!won;
    vs.why = why || vs.why;
    vs.reconnecting = false;
    setLink("");
    const g = app.g;
    if (g && g.vs && !g.result) {
      if (won) g.endRun(true);
      else { g.garrison = Math.max(0, g.garrison); g.endRun(false); }
    }
    vs.net.close();
  }

  function quitMatch() {
    if (!vs) return;
    if (!vs.ended) { vs.net.send({ t: "leave" }); vs.ended = true; }
    vs.net.close();
    vs = null;
    const bar = $("vs-bar");
    if (bar) bar.remove();
    const res = $("vs-result");
    if (res) res.classList.add("hidden");
    document.body.classList.remove("vs-on");
  }

  const baseResult = UP.showResult;
  UP.showResult = function () {
    const g = this.g;
    if (!g || !g.vs) return baseResult.apply(this, arguments);
    showVersusResult(g);
  };

  function showVersusResult(g) {
    $("hud").classList.add("hidden");
    let el = $("vs-result");
    if (!el) {
      el = document.createElement("div");
      el.id = "vs-result";
      el.className = "overlay";
      $("result").after(el);
    }
    const won = vs ? vs.won || (g.result && g.result.won) : g.result && g.result.won;
    const why = vs ? vs.why : "";
    const oppWave = vs ? Math.max(1, vs.opp.wave) : 0;
    let line;
    if (won) line = why === "disconnected" ? "Your opponent's connection never came back." : why === "left" || why === "surrendered" ? "Your opponent surrendered." : `Their line broke at wave ${oppWave}.`;
    else line = why === "surrendered" ? "You surrendered." : why === "lost connection" ? "This Chromebook lost the connection to the battle server." : `Your line broke at wave ${Math.max(1, g.wave)}.`;
    const stat = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
    el.classList.remove("hidden", "win", "lose");
    el.classList.add(won ? "win" : "lose");
    el.innerHTML = `
      <div class="kicker">1 v 1 · ${g.map.name}</div>
      <h2>${won ? "Victory" : "Defeat"}</h2>
      <p class="vs-why">${line}</p>
      <div class="res-stats">${stat("Waves held", Math.max(0, won ? g.wave : g.wave - 1))}${stat("Kills", g.kills)}${stat("Units sent", vs ? vs.sent : 0)}${stat("Income earned", (vs ? vs.earned : 0) + " zł")}</div>
      <div class="menu row">
        <button class="big" id="vs-again">Play again</button>
        <button id="vs-menu">Menu</button>
      </div>`;
    $("vs-again").onclick = () => { BK.Audio.ui(); el.classList.add("hidden"); app.toTitle(); openLobby(); };
    $("vs-menu").onclick = () => { BK.Audio.ui(); el.classList.add("hidden"); app.toTitle(); };
  }

  // The lobby is a screen like the others.
  const baseScreen = UP.screen;
  UP.screen = function (name) {
    baseScreen.call(this, name);
    const el = $("versus");
    if (el) el.classList.toggle("hidden", name !== "versus");
  };

  buildLobby();
  BK.Versus = { SENDS, servers: SERVERS, state: () => vs, trySend };
})(typeof window !== "undefined" ? window : globalThis);

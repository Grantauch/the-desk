// The field manual: every gun and enemy unit with its history and numbers, filled in as each is first seen.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);
  const UP = BK.UI.prototype;
  const Save = BK.Save;

  BK.ENEMY_NOTES = {
    inf: "German rifle squads of 1939 carried the Kar98k bolt action rifle, with an MG 34 to every squad.",
    officer: "Junior officers led from the front and were the first target for Polish riflemen.",
    moto: "Motorcycle troops scouted ahead of the panzer divisions, often with a sidecar machine gun.",
    truck: "Most of the German army still moved by horse and truck. Fuel and ammunition rode in columns like this one.",
    armcar: "Light armored cars such as the Sd.Kfz. 222 scouted roads and raked positions with a 20mm gun.",
    ltank: "Most German tanks in Poland were the light Panzer I and Panzer II. Polish 37mm guns went through them easily.",
    smoke: "Tank crews carried smoke candles to screen a crossing or a retreat.",
    htrack: "The Sd.Kfz. 251 half track carried a rifle squad behind thin armor with an open top.",
    mtank: "The Panzer IV was the heaviest German tank in Poland, and only about two hundred took part.",
    stuka: "The Ju 87 Stuka dive bomber screamed down on bridges, rail lines and gun positions from the first morning.",
    recon: "Spotter planes such as the Hs 126 circled over the front and called artillery onto Polish positions.",
    command: "Command tanks carried a frame antenna instead of a gun. Their radios held the panzer columns together.",
    leader: "A Staffel leader brought his formation in and picked the targets for the dive.",
    nbfz: "The Neubaufahrzeug was a multi turret prototype. A few were sent to Norway in 1940, and the game imagines one here.",
    pioneer: "Assault pioneers used the Flammenwerfer 35 against bunkers. One man carried the whole set on his back.",
    sniper: "German snipers worked from cover with a scoped Kar98k and hunted officers and gun crews.",
    mortarteam: "The 81mm Granatwerfer 34 gave every infantry battalion its own artillery.",
    engineer: "Combat engineers cleared mines and wire and rebuilt bridges under fire.",
    armcar8: "The heavy armored car of the reconnaissance battalions, with a 20mm gun and a driver at each end so it could back out of trouble.",
  };

  // Mark what the player has met, a little after it shows up.
  const baseFrame = UP.frame;
  UP.frame = function (dt) {
    baseFrame.call(this, dt);
    const g = this.g;
    if (!g || g.demo) return;
    this.manT = (this.manT || 0) - dt;
    if (this.manT > 0) return;
    this.manT = 1;
    const S = Save.data;
    const M = S.manual || (S.manual = { e: {}, g: {} });
    let changed = false;
    for (const e of g.enemies) if (!M.e[e.kind] && e.x > 0) { M.e[e.kind] = 1; changed = true; }
    for (const t of g.towers) if (!M.g[t.kind]) { M.g[t.kind] = 1; changed = true; }
    if (changed) Save.write();
  };

  UP.showManual = function (tab) {
    this.screen("notes");
    const S = Save.data;
    const M = S.manual || (S.manual = { e: {}, g: {} });
    // Older saves already met the units they got tips for.
    for (const k in S.seen || {}) if (BK.ENEMIES[k]) M.e[k] = 1;
    tab = tab || this.manualTab || "guns";
    this.manualTab = tab;
    $("notes").querySelector("h2").textContent = "Field manual";
    const pct = (v) => Math.round(v * 100) + "%";
    let h = `<div class="mtabs"><button data-t="guns" class="${tab === "guns" ? "on" : ""}">Guns</button><button data-t="enemy" class="${tab === "enemy" ? "on" : ""}">The enemy</button><button data-t="notes">Field notes</button></div>`;
    h += `<div class="mgrid">`;
    if (tab === "guns") {
      for (const k of BK.GUN_ORDER) {
        const d = BK.GUNS[k];
        const seen = M.g[k] || (!d.unlock && k === "mg");
        const forms = Object.keys(BK.TREES[k] || {}).length;
        if (!seen) { h += `<div class="ment locked"><div class="mic">?</div><div><b>Not fielded yet</b><small>Build one to learn more.</small></div></div>`; continue; }
        const st = d.support ? `<span>Reach ${Math.round(d.range)}</span><span>Health ${d.hp}</span><span>${d.cost} zł</span>` : `<span>Damage ${d.dmg}</span><span>Shots/s ${d.rate}</span><span>Range ${Math.round(d.range)}</span><span>Pierce ${pct(d.pen)}</span><span>Health ${d.hp}</span><span>${d.cost} zł</span>`;
        h += `<div class="ment"><img alt="" src="${BK.Art.gunIcon(k, 56)}"><div><b>${d.name}</b><small class="mrole">${d.role}. ${forms} forms in its tree.</small><p>${d.history}</p><div class="mst">${st}</div></div></div>`;
      }
    } else {
      const order = ["inf", "officer", "moto", "truck", "armcar", "armcar8", "ltank", "smoke", "htrack", "mtank", "stuka", "recon", "pioneer", "sniper", "mortarteam", "engineer", "command", "leader", "nbfz"];
      for (const k of order) {
        const d = BK.ENEMIES[k];
        if (!d) continue;
        if (!M.e[k]) { h += `<div class="ment locked"><div class="mic">?</div><div><b>Not yet met</b><small>${d.boss ? "A boss column leader." : "Keep holding the road."}</small></div></div>`; continue; }
        const kind = { foot: "On foot", wheel: "Wheeled", track: "Tracked", half: "Half track", air: "Aircraft" }[d.kind] || "";
        const st = `<span>${kind}</span><span>Health ${d.hp}</span><span>Armor ${pct(d.armor)}</span><span>Speed ${d.speed}</span><span>Pays ${d.reward}</span>${d.leak ? `<span>Costs ${d.leak} garrison</span>` : ""}`;
        h += `<div class="ment${d.boss ? " boss" : ""}"><img alt="" src="${BK.Art.enemyIcon(k, 56)}"><div><b>${d.name}</b>${d.tip ? `<small class="mrole">${d.tip}</small>` : ""}<p>${BK.ENEMY_NOTES[k] || ""}</p><div class="mst">${st}</div></div></div>`;
      }
    }
    h += `</div>`;
    const b = $("notes-body");
    b.innerHTML = h;
    b.scrollTop = 0;
    b.querySelectorAll(".mtabs button").forEach((x) => {
      x.onclick = () => { BK.Audio.ui(); if (x.dataset.t === "notes") this.showNotes(); else this.showManual(x.dataset.t); };
    });
  };
  // Field notes gain a way into the manual, and the heading goes back to normal.
  const baseNotes = UP.showNotes;
  UP.showNotes = function () {
    baseNotes.call(this);
    $("notes").querySelector("h2").textContent = "Field notes";
    const b = $("notes-body");
    b.insertAdjacentHTML("afterbegin", `<div class="mtabs"><button data-t="guns">Guns</button><button data-t="enemy">The enemy</button><button data-t="notes" class="on">Field notes</button></div>`);
    b.querySelectorAll(".mtabs button").forEach((x) => {
      x.onclick = () => { BK.Audio.ui(); if (x.dataset.t !== "notes") this.showManual(x.dataset.t); };
    });
    const extra = `<h3>Newer orders</h3>`
      + `<p><b>Difficulty and stars.</b> Pick Recruit, Regular, Veteran or Iron Wall above the battlefields. Harder levels pay more medals. A win earns one star, two if you finish with at least half your starting garrison, and three if you finish with all of it. Each field keeps its best stars for every level.</p>`
      + `<p><b>The commander.</b> ${BK.HERO.name} fights beside the guns with his runner. Click him or press H, then click where he should go. Q rallies the guns around him to fire faster. N throws grenades at the nearest knot of enemies. He gains levels during a battle and comes back after a short wait if he falls.</p>`
      + `<p><b>Saving.</b> The battle saves itself at the start of every build phase. Close the tab and pick Resume on the title screen.</p>`
      + `<p><b>Daily challenge.</b> One field, weather and set of orders for the day, the same for everyone. Your best score for each day is kept.</p>`
      + `<p><b>Command.</b> Medals now buy steps in four branches: Artillery, Engineering, Logistics and Intelligence. Each branch opens one step at a time, and the new perks add damage, health, reach, faster abilities or supplies at the start of every battle.</p>`
      + `<p><b>Bosses fight back harder.</b> The command tank surges the column forward and lays smoke at half health, then buttons up and calls motorcycles. The Neubaufahrzeug speeds up its turrets and makes a last push for the town. Watch for the Sd.Kfz. 231 eight wheeler in the later waves.</p>`
      + `<p><b>Handy keys.</b> L shows every gun's reach. Backspace picks up a gun placed in this build phase for a full refund. Hover a button to see its key.</p>`;
    const h3 = b.querySelector("h3");
    if (h3) h3.insertAdjacentHTML("beforebegin", extra);
  };

  // A button for the manual on the title screen.
  const baseScreen = UP.screen;
  UP.screen = function (name) {
    baseScreen.call(this, name);
    if (name !== "title" || $("b-manual")) return;
    const notes = $("b-notes");
    if (!notes) return;
    const b = document.createElement("button");
    b.id = "b-manual";
    b.innerHTML = `<i data-ic="target"></i> Field manual`;
    b.onclick = () => { BK.Audio.unlock(); this.showManual("guns"); };
    notes.after(b);
    if (BK.paintIcons) BK.paintIcons(b.parentNode);
  };
})(typeof window !== "undefined" ? window : globalThis);

(async function () {
  "use strict";
  const school = globalThis.ChecklingSchool;
  const schoolSession = school ? await school.ready : null;
  // An isolated memory-only store prevents shared Chromebook account leakage.
  const ephemeral = new Map();
  const localStorage = school ? {getItem:key => ephemeral.get(key) || null,setItem:(key,value) => ephemeral.set(key,value)} : window.localStorage;
  const E = globalThis.FirstTrail;
  const G = globalThis.CampGoals;
  const $ = (id) => document.getElementById(id);
  const KEY = "checklings.first-trail.v1",
    BACKUP = KEY + ".before-import";
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const affinity = {
    mochi: "Meadow friend",
    bolt: "Tiny tinkerer",
    zee: "Star watcher",
    ember: "Pocket dragon",
  };
  const trailNames = ["SEED GATE", "OLD WATERWHEEL", "STAR POND"];
  const trailHints = [
    "Something’s growing here.",
    "That wheel needs a nudge.",
    "What’s hiding in the reeds?",
  ];
  const trailActions = {
    mochi: ["Plant", "Water", "Gather"],
    bolt: ["Inspect", "Repair", "Measure"],
    zee: ["Observe", "Study", "Stargaze"],
    ember: ["Warm", "Mend", "Light"],
  };
  const signatureNames = {
    mochi: "Cozy",
    bolt: "Scrap",
    zee: "Orbit",
    ember: "Burst",
  };
  const signatureHints = {
    mochi: "Blanket: hit + shield.",
    bolt: "Block hits to charge Salvage.",
    zee: "Orbit alternates power and shield.",
    ember: "Recover stores one heat burst.",
  };
  const statInfo = [
    ["food", "Food", "food"],
    ["energy", "Energy", "bed"],
    ["clean", "Comfort", "brush"],
    ["joy", "Mood", "ball"],
    ["bond", "Bond", "badge"],
  ];
  const initialPositions = {
    mochi: { x: 30, y: 65 },
    bolt: { x: 60, y: 55 },
    zee: { x: 79, y: 77 },
    ember: { x: 50, y: 87 },
  };
  const positions = structuredClone(initialPositions);
  let state = E.initial(),
    view = "home",
    journalPage = "notes",
    battle = null,
    practiceFounder = "mochi",
    pending = null,
    storageOK = true,
    memoryBackup = null,
    poseTimer,
    propTimer,
    nameFromMenu = false,
    importTicket = 0;
  let welcome = "Pick a friend. Let’s play!";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) state = E.hydrate(JSON.parse(saved));
  } catch {
    storageOK = false;
    welcome =
      "This save needs help. It’s untouched. You can still play and save to a file.";
  }

  let schoolRevision = schoolSession?.revision || 0;
  let schoolQueued = null, schoolFlight = null, schoolFailed = null;
  if (schoolSession) {
    state = E.hydrate(schoolSession.camp);
    practiceFounder = state.selected;
    welcome = "Your school camp is ready. Your original companion is here.";
    const pet = schoolSession.school.companion.pet;
    const banner = document.createElement('section');
    banner.className = 'school-banner panel';
    banner.setAttribute('aria-label','School companion and attendance');
    const official = schoolSession.school;
    banner.innerHTML = '<strong></strong><p></p><p class="school-homes"></p>';
    banner.querySelector('strong').textContent = pet.name + ' · ' + official.companion.stage;
    banner.querySelector('p').textContent = 'Official streak: ' + official.streak.current + ' · best: ' + official.companion.bestStreak + '. ' + (official.checkedIn ? official.companion.countedToday ? 'Today’s check-in is recorded.' : 'Today’s sign-in is recorded; points await teacher review.' : official.companion.protectedDay ? 'School day off: your streak is protected.' : 'Not checked in today. Use Check-In to record attendance.');
    banner.querySelector('.school-homes').textContent = 'Home: ' + (official.companion.journey.find(home => home.habitat === pet.habitat)?.home || pet.habitat) + '. Earned homes: ' + official.companion.journey.filter(home => home.unlocked).map(home => home.home).join(' · ');
    $('game').prepend(banner);
    document.querySelector('.game-help').textContent = 'Saved privately with your school PIN and selected class. Playing adds no attendance or points. Close camp and choose Done when finished.';
    document.querySelector('.menu-note').textContent = 'Your camp follows your school PIN across devices. Save a file before importing an older browser camp.';
    document.querySelector('.about-playtest p:nth-of-type(2)').textContent = 'School camp: your original Checkling, name and earned home are preserved. Extra party friends, trail stamps and camp goals are game progress. Official school streaks remain separate.';
    document.querySelector('.skip').addEventListener('click',event => {event.preventDefault();$('actions').focus();});
    document.querySelectorAll('.close-form button').forEach(button => button.addEventListener('click',event => {event.preventDefault();button.closest('dialog').close();}));
    const retry = document.createElement('button');
    retry.id = 'school-save-retry'; retry.type = 'button'; retry.textContent = 'Retry school save'; retry.hidden = true;
    $('save-status').after(retry);
    retry.onclick = () => { if (schoolFailed) { schoolFlight = schoolFailed; schoolFailed = null; flushSchoolSave(); } };
  }
  const schoolMutation = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),byte => byte.toString(16).padStart(2,'0')).join('');
  async function flushSchoolSave() {
    if (!schoolFlight && schoolQueued) { schoolFlight = {camp:schoolQueued,expectedRevision:schoolRevision,mutationId:schoolMutation()}; schoolQueued = null; }
    if (!schoolFlight) return;
    const flight = schoolFlight;
    $('save-status').textContent = 'Saving to school…';
    $('school-save-retry').hidden = true;
    try {
      const saved = await school.request('save',flight);
      schoolRevision = saved.revision;
      schoolFlight = null;
      if (schoolQueued) return flushSchoolSave();
      $('save-status').textContent = 'Saved to school';
    } catch (error) {
      schoolFailed = flight; schoolFlight = null;
      $('save-status').textContent = 'Not saved to school';
      $('school-save-retry').hidden = false;
      say(error.message + ' Menu → Save to file keeps your current camp.');
    }
  }

  function item(kind, extra = "") {
    return (
      '<span class="item i-' +
      kind +
      " " +
      extra +
      '" aria-hidden="true"></span>'
    );
  }
  function name(id = state.selected) {
    return E.name(state, id);
  }
  // Artwork recovery belongs to this page, never to the portable camp save.
  const failedMovingArt = new Set(), movingArtRetries = new Map();
  function artSource(id, ext) {
    const file = id + "." + ext;
    return globalThis.PIXEL_CAMP_ART?.[file] || "assets/" + file;
  }
  function art(id, still = false) {
    if (still || effectiveQuiet() || failedMovingArt.has(id)) return artSource(id, "png");
    let source = artSource(id, "gif");
    const retries = movingArtRetries.get(id) || 0;
    if (retries && !source.startsWith("data:")) {
      const url = new URL(source, document.baseURI);
      if (url.protocol === "https:" || url.protocol === "http:") {
        url.searchParams.set("art-retry", String(retries));
        source = url.href;
      }
    }
    return source;
  }
  function movingArtOwner(image) {
    if (image?.tagName !== "IMG") return null;
    const id = image.id === "battle-friend-art" ? image.dataset.pet : image.parentElement?.matches(".actor") ? image.parentElement.dataset.pet : null;
    return E.IDS.includes(id) ? id : null;
  }
  function updateFounderPictureHelp() {
    $("founder-picture-help").hidden = !failedMovingArt.size || effectiveQuiet();
    $("founder-picture-message").textContent = failedMovingArt.size ? "Some moving pictures didn’t load. Still pictures are on." : "";
  }
  document.addEventListener("error", (event) => {
    const image = event.target, id = movingArtOwner(image);
    if (!id || !image.complete || image.naturalWidth !== 0 || effectiveQuiet()) return;
    const current = image.getAttribute("src"), original = artSource(id, "gif");
    if (!current) return;
    // Accept only the currently requested original animation, including our retry query.
    let expected = original;
    if (!original.startsWith("data:")) {
      const url = new URL(original, document.baseURI), count = movingArtRetries.get(id) || 0;
      if (count && (url.protocol === "https:" || url.protocol === "http:")) url.searchParams.set("art-retry", String(count));
      expected = url.href;
    }
    if (image.src !== expected) return;
    failedMovingArt.add(id);
    image.src = artSource(id, "png");
    updateFounderPictureHelp();
  }, true);
  $("retry-founder-art").onclick = () => {
    if (effectiveQuiet() || !failedMovingArt.size) return;
    const retry = new Set(failedMovingArt);
    for (const id of retry) movingArtRetries.set(id, Math.min(1000000, (movingArtRetries.get(id) || 0) + 1));
    failedMovingArt.clear();
    for (const image of document.querySelectorAll(".actor img, #battle-friend-art")) {
      const id = movingArtOwner(image);
      if (retry.has(id)) { image.removeAttribute("src"); image.src = art(id); }
    }
    // Keep the dialog and its next keyboard action usable when this notice hides.
    if ($("founder-picture-help").contains(document.activeElement)) $("menu-dialog").querySelector(".close-form button").focus();
    updateFounderPictureHelp();
  };
  function say(text) {
    $("message").textContent = text;
  }
  function effectiveQuiet() {
    return state.quiet || media.matches;
  }
  function persist() {
    if (schoolSession) {
      state.pets[schoolSession.founder].nickname = schoolSession.school.companion.pet.name;
      schoolQueued = E.hydrate(state);
      if (!schoolFlight && !schoolFailed) flushSchoolSave();
      return;
    }
    if (!storageOK) {
      $("save-status").textContent = "Save to file";
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $("save-status").textContent = "Saved";
    } catch {
      storageOK = false;
      $("save-status").textContent = "Save to file";
      say(
        "Browser saving is full or blocked. Menu → Save to file keeps your camp.",
      );
    }
  }
  function shortReply(action, result, before) {
    const id = before.selected,
      n = name(id);
    if (!result.changed)
      return (
        result.message ||
        (action.type === "stop"
          ? trailHints[state.stop]
          : name() + " is ready!")
      );
    if (action.type === "select")
      return n === name() ? name() + " is ready!" : name() + " joined you.";
    if (action.type === "feed") return n + " munches the berries. Snack time!";
    if (action.type === "play") return n + " chases the ball!";
    if (action.type === "clean") return n + " is fresh and comfy.";
    if (action.type === "rest") return n + " takes a breather. Energy full!";
    if (action.type === "observe")
      return "You hang out with " + n + ". A new journal note!";
    if (action.type === "discover")
      return "FOUND: " + E.SPECIES[id].finds[before.stop] + ". +1 stamp!";
    if (action.type === "stop") return trailHints[state.stop];
    if (action.type === "weather")
      return {
        sun: "The sun’s out!",
        rain: "Rainy day. Camp is cozy.",
        dusk: "Lantern time. Look at those stars.",
      }[state.weather];
    if (action.type === "rename") return "Hey, " + name() + "!";
    if (action.type === "unlock")
      return E.DECOR.find((d) => d.id === action.id).name + " placed!";
    if (action.type === "quiet")
      return effectiveQuiet()
        ? "Quiet sprites on. Same game."
        : "A little wiggle is back.";
    return result.message;
  }
  function act(action) {
    const before = state,
      result = E.dispatch(state, action);
    state = result.state;
    if (result.changed) persist();
    render();
    say(shortReply(action, result, before));
    if (
      result.changed &&
      ["feed", "play", "clean", "rest"].includes(action.type)
    )
      showCareProp(action.type);
    return result;
  }
  function setView(next) {
    if (!["home", "trail", "practice", "journal"].includes(next)) return;
    view = next;
    clearTimeout(propTimer);
    $("care-prop").hidden = true;
    render();
    say(
      next === "trail"
        ? trailHints[state.stop]
        : next === "practice"
          ? "Pick your lead. The stump is ready."
          : next === "home"
            ? name() + " is back at camp."
            : "A few things worth keeping.",
    );
  }
  function focusParty(id) {
    document.querySelector('#party-list [data-pet="' + id + '"]').focus();
  }
  function selectPet(id) {
    if (battle && view === "practice" && !battle.result) {
      move("switch", id);
      return;
    }
    // A finished spar has already awarded its badge. A new party choice readies a fresh lead.
    if (battle && battle.result) { battle = null; clearTimeout(poseTimer); }
    act({ type: "select", id });
  }
  function renderParty() {
    const sparring = view === "practice" && battle;
    const active = sparring ? battle.active : state.selected;
    $("party-list").innerHTML = E.IDS.map((id) => {
      const p = state.pets[id],
        bp = sparring ? battle.fighters[id] : null;
      const sub = bp ? bp.hp + "/65 HP" : affinity[id];
      return (
        '<button type="button" class="party-button" data-pet="' +
        id +
        '" aria-pressed="' +
        (active === id) +
        '" ' +
        (bp && bp.hp === 0 && !battle.result ? "disabled" : "") +
        '><img src="' +
        art(id, true) +
        '" alt="" width="57" height="57"><strong>' +
        escape(name(id)) +
        "</strong><small>" +
        sub +
        "</small></button>"
      );
    }).join("");
    $("pet-name").textContent = name(active);
    $("pet-region").textContent = E.SPECIES[active].region.toUpperCase();
    const values = sparring
      ? [
          ["hp", "Practice HP", "badge", battle.fighters[active].hp, 65],
          ["sp", "Stamina", "bed", battle.fighters[active].stamina, 10],
        ]
      : statInfo.map(([key, label, icon]) => [
          key,
          label,
          icon,
          state.pets[active][key],
          100,
        ]);
    $("vitals").innerHTML = values
      .map(
        ([key, label, icon, value, max]) =>
          '<div class="vital" data-stat="' +
          key +
          '">' +
          item(icon) +
          '<span class="vital-label">' +
          label +
          '</span><span class="vital-value">' +
          value +
          "/" +
          max +
          '</span><meter min="0" max="' +
          max +
          '" value="' +
          value +
          '" aria-label="' +
          label +
          " " +
          value +
          " out of " +
          max +
          '">' +
          value +
          "/" +
          max +
          "</meter></div>",
      )
      .join("");
    $("pet-note").textContent = sparring
      ? signatureHints[active]
      : {
          mochi: "Play, then a cozy rest.",
          bolt: "Big ideas. Small breaks.",
          zee: "Quiet company. Clear skies.",
          ember: "Snack first. Wings need rest.",
        }[active];
    $("discovery-count").textContent =
      E.IDS.reduce((sum, id) => sum + state.pets[id].discoveries.length, 0) +
      " / 12";
  }
  function renderActors() {
    $("actors").hidden = view === "practice";
    $("ground").hidden = view !== "home";
    $("actors").innerHTML = E.IDS.filter(
      (id) => view !== "trail" || id === state.selected,
    )
      .map((id) => {
        const p = view === "trail" ? { x: 38, y: 83 } : positions[id];
        return (
          '<button type="button" class="actor" data-pet="' +
          id +
          '" style="left:' +
          p.x +
          "%;top:" +
          p.y +
          '%" aria-label="Choose ' +
          escape(name(id)) +
          '" aria-pressed="' +
          (state.selected === id) +
          '"><img src="' +
          art(id) +
          '" alt="" width="160" height="160"><span class="actor-name">' +
          escape(name(id)) +
          "</span></button>"
        );
      })
      .join("");
    $("trail-landmark").hidden = view !== "trail";
    $("trail-landmark").dataset.stop = state.stop;
    $("camp-decoration").hidden = !state.equipped || view !== "home";
    $("camp-decoration").className =
      "camp-decoration item i-" +
      ({ planter: "planter", lantern: "lantern", pennants: "pennants" }[
        state.equipped
      ] || "planter");
  }
  function renderRoute() {
    $("route-stops").hidden = view !== "trail";
    const found = state.pets[state.selected].discoveries;
    $("route-stops").innerHTML = trailNames
      .map(
        (label, index) =>
          '<button type="button" data-stop="' +
          index +
          '" aria-pressed="' +
          (index === state.stop) +
          '"><span class="route-icon" style="background-position:' +
          index * 50 +
          '% 0" aria-hidden="true"></span><span>' +
          label +
          "<small>" +
          (found.includes(index) ? "Found it!" : "Unexplored") +
          "</small></span></button>",
      )
      .join("");
    $("discover-label").textContent = trailActions[state.selected][state.stop];
  }
  function renderDecor() {
    $("decor-stamps").textContent = E.stamps(state) + " trail stamps";
    $("decor-items").innerHTML = E.DECOR.map((d) => {
      const can = E.stamps(state) >= d.cost,
        owned = state.decor.includes(d.id),
        placed = state.equipped === d.id;
      return (
        '<div class="decor-item">' +
        item(d.id) +
        "<h3>" +
        d.name +
        "</h3><p>" +
        (owned ? "Yours!" : d.cost + " stamps to unlock") +
        '</p><button type="button" data-decor="' +
        d.id +
        '" aria-pressed="' +
        placed +
        '" ' +
        (!can ? "disabled" : "") +
        ">" +
        (placed ? "Placed" : can ? "Place" : "Locked") +
        "</button></div>"
      );
    }).join("");
  }
  function goalNeedsRest(next) {
    return !!next && ((next.kind === "care" && next.action === "play" && state.pets[next.pet].energy < 25) || (next.kind === "trail" && state.pets[next.pet].energy < 18));
  }
  function goalHint(next) {
    if (!next) return "All set!";
    if (goalNeedsRest(next)) return "Rest with " + name(next.pet) + (next.kind === "trail" ? " before exploring." : " before playing.");
    if (next.kind === "care") return ({ feed: "Feed ", play: "Play with ", clean: "Brush ", rest: "Rest with ", observe: "Hang out with " }[next.action]) + name(next.pet) + ".";
    if (next.kind === "trail") return "Explore " + ["Seed Gate", "Old Waterwheel", "Star Pond"][next.stop] + " with " + name(next.pet) + ".";
    if (next.kind === "practice") return "Lead a practice with " + name(next.pet) + ".";
    return "Place the " + E.DECOR.find(d => d.id === next.id).name.toLowerCase() + ".";
  }
  function renderCampGoals() {
    const goals = G.read(state);
    $("camp-goals-summary").textContent = goals.complete ? "Camp goals complete. Willowbank feels like home!" : goals.completedTracks + " / 4 camp goals complete. Take it at your own pace.";
    $("camp-goals-list").innerHTML = goals.tracks.map(track => '<div class="camp-goal-row" data-goal-row="' + track.id + '">' + item(track.icon) + '<div class="camp-goal-copy"><div class="camp-goal-heading"><h3>' + track.title + '</h3><strong>' + track.done + ' / ' + track.total + '</strong></div><p>' + escape(goalHint(track.next)) + '</p><progress value="' + track.done + '" max="' + track.total + '" aria-label="' + track.title + ' ' + track.done + ' out of ' + track.total + '">' + track.done + '/' + track.total + '</progress></div><button type="button" data-camp-goal="' + track.id + '" aria-label="' + track.title + (track.next ? ' next task' : ' complete') + '" ' + (track.next ? '' : 'disabled') + '>' + (track.next ? 'Next' : 'Done') + '</button></div>').join("");
  }
  function followCampGoal(id) {
    const track = G.read(state).tracks.find(track => track.id === id), next = track && track.next;
    if (!next) return;
    if (next.kind === "practice" && battle && !battle.result) {
      setView("practice"); say("Finish this spar first. Your next friend can go after.");
      (document.querySelector('[data-move="guard"]:not(:disabled)') || document.querySelector('.party-button:not(:disabled)')).focus(); return;
    }
    if (next.kind === "decor") { setView("home"); openDecor(); return; }
    if (next.kind === "practice") { battle = null; clearTimeout(poseTimer); }
    act({ type: "select", id: next.pet });
    if (next.kind === "care") { setView("home"); say(goalHint(next)); document.querySelector('#care-actions [data-care="' + (goalNeedsRest(next) ? 'rest' : next.action) + '"]').focus(); }
    if (next.kind === "trail") { act({ type: "stop", value: next.stop }); setView("trail"); say(goalHint(next)); (goalNeedsRest(next) ? document.querySelector('#trail-actions [data-care="rest"]') : $("discover")).focus(); }
    if (next.kind === "practice") { setView("practice"); say(goalHint(next)); $("start-practice").focus(); }
  }

  function renderJournal() {
    const p = state.pets[state.selected];
    const goalsPage = journalPage === "goals";
    $("journal-notes").hidden = goalsPage; $("camp-goals").hidden = !goalsPage;
    for (const tab of document.querySelectorAll("[data-journal-page]")) tab.setAttribute("aria-pressed", String(tab.dataset.journalPage === journalPage));
    $("journal-title").textContent = goalsPage ? "Camp goals" : name() + "’s notes";
    if (goalsPage) renderCampGoals();
    $("journal-friend").textContent = name();
    $("journal-art").src = art(state.selected, true);
    $("journal-art").alt = name();
    $("journal-progress").textContent = p.discoveries.length + "/3 discoveries";
    $("practice-badge").hidden = !p.battles;
    $("journal-empty").hidden = p.memories.length > 0;
    $("journal-entries").innerHTML = p.memories
      .slice()
      .reverse()
      .map(
        (m) =>
          '<li data-kind="' +
          (m.id.startsWith("find") ? "find" : "memory") +
          '">' +
          escape(m.id === "practice" ? "Practice with the stump. Everyone’s okay." : m.text) +
          "</li>",
      )
      .join("");
  }
  function defaultStumpPose() {
    if (!battle) return "0";
    if (battle.result) return battle.result === "win" ? "3" : "0";
    return ["0", "2", "2", "1"][battle.turn % 4];
  }
  function renderBattle() {
    const inPractice = view === "practice";
    $("stump-picture-state").hidden = !inPractice || !battle || $("stump-sprite").dataset.art === "ready";
    $("practice-welcome").hidden = !inPractice || !!battle;
    $("combat-scene").hidden = !inPractice || !battle;
    $("practice-log").hidden = !inPractice || !battle;
    for (const button of document.querySelectorAll("[data-move]"))
      button.disabled = !battle || !!battle.result;
    $("signature-label").textContent = signatureNames[battle ? battle.active : state.selected];
    if (!battle) return;
    const p = battle.fighters[battle.active];
    $("battle-friend-name").textContent = name(battle.active);
    $("battle-friend-art").dataset.pet = battle.active;
    $("battle-friend-art").src = art(battle.active);
    $("battle-friend-art").alt = name(battle.active) + " practicing";
    $("friend-hp").value = p.hp;
    $("friend-hp-text").textContent = p.hp + "/65";
    $("friend-sp").value = p.stamina;
    $("friend-sp-text").textContent = p.stamina + "/10";
    $("enemy-hp").value = battle.enemy;
    $("enemy-hp-text").textContent = battle.enemy + "/125";
    $("enemy-intent").textContent = battle.result
      ? "DONE"
      : ["STRIKE · 12", "WIND-UP", "BIG HIT · 28", "REST"][battle.turn % 4];
    $("stump-sprite").dataset.pose = defaultStumpPose();
    for (const button of document.querySelectorAll("[data-move]"))
      button.disabled =
        !!battle.result ||
        p.hp === 0 ||
        (button.dataset.move === "strike" && p.stamina < 3) ||
        (button.dataset.move === "signature" && p.stamina < 5);
    $("practice-result").hidden = !battle.result;
    $("result-title").textContent =
      battle.result === "win" ? "PRACTICE CLEAR!" : "GOOD TRY!";
    $("result-copy").textContent =
      battle.result === "win"
        ? name(practiceFounder) + " keeps the badge. Everyone’s okay!"
        : "Everyone’s okay. Guard the big swing next time.";
    $("battle-log").innerHTML = battle.log
      .map(
        (line) => "<li>" + escape(line.replaceAll("Dummy", "Stump")) + "</li>",
      )
      .join("");
  }
  function render() {
    document.body.classList.toggle("quiet", effectiveQuiet());
    const skip = document.querySelector(".skip");
    skip.href = view === "journal" ? "#journal-view" : "#actions";
    skip.textContent = view === "journal" ? "Skip to journal" : "Skip to actions";
    for (const button of document.querySelectorAll("[data-view]"))
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    $("world-view").hidden = view === "journal";
    $("journal-view").hidden = view !== "journal";
    $("care-actions").hidden = view !== "home";
    $("trail-actions").hidden = view !== "trail";
    $("battle-actions").hidden = view !== "practice";
    $("world").dataset.weather = state.weather;
    $("weather").value = state.weather;
    $("location-name").textContent =
      view === "trail"
        ? trailNames[state.stop]
        : view === "practice"
          ? "PRACTICE PATCH"
          : "WILLOWBANK CAMP";
    $("location-hint").textContent =
      view === "trail"
        ? state.pets[state.selected].discoveries.includes(state.stop)
          ? "Already in your journal."
          : "Find something new."
        : view === "practice"
          ? "Friendly match. No injuries."
          : "Pick a friend.";
    $("speaker-name").textContent = (
      view === "practice" ? "PRACTICE" : name()
    ).toUpperCase();
    $("speaker-art").src = art(
      view === "practice" && battle ? battle.active : state.selected,
      true,
    );
    $("stamp-count").textContent = E.stamps(state);
    $("action-hint").textContent =
      view === "practice"
        ? battle
          ? signatureHints[battle.active] + " Switching takes a turn."
          : "Pick a lead friend, then start."
        : view === "trail"
          ? "Each friend finds different things. Rest is free."
          : "Choose a friend. Pick an action.";
    $("quiet-toggle").setAttribute("aria-pressed", String(state.quiet));
    $("quiet-label").textContent =
      "Quiet: " + (state.quiet ? "On" : media.matches ? "System" : "Off");
    updateFounderPictureHelp();
    renderParty();
    renderActors();
    renderRoute();
    renderDecor();
    renderBattle();
    if (view === "journal") renderJournal();
  }
  function showCareProp(type) {
    clearTimeout(propTimer);
    const icon = { feed: "food", play: "ball", clean: "brush", rest: "bed" }[
        type
      ],
      p = positions[state.selected];
    if (view !== "home" || !icon) return;
    $("care-prop").className = "care-prop item i-" + icon;
    $("care-prop").style.left = p.x + 7 + "%";
    $("care-prop").style.top = p.y - 8 + "%";
    $("care-prop").hidden = false;
    propTimer = setTimeout(
      () => ($("care-prop").hidden = true),
      effectiveQuiet() ? 1600 : 2200,
    );
  }
  function startPractice() {
    practiceFounder = state.selected;
    battle = E.startBattle(practiceFounder);
    clearTimeout(poseTimer);
    render();
    say("The stump is going to strike. What’s your move?");
    document.querySelector('[data-move="strike"]').focus();
  }
  function move(type, id) {
    if (!battle) return;
    const beforeEnemy = battle.enemy,
      result = E.battleMove(battle, type, id);
    battle = result.battle;
    if (result.changed && battle.result === "win") {
      const selected = state.selected;
      state.selected = practiceFounder;
      const reward = E.dispatch(state, { type: "battle-win" });
      state = reward.state;
      state.selected = selected;
      if (reward.changed) persist();
    }
    render();
    say(
      result.message.replaceAll("Dummy", "Stump").replaceAll("dummy", "stump"),
    );
    if (battle.result && result.changed) $("retry-practice").focus();
    clearTimeout(poseTimer);
    if (
      result.changed &&
      battle.enemy < beforeEnemy &&
      !effectiveQuiet() &&
      !battle.result
    ) {
      $("stump-sprite").dataset.pose = "3";
      poseTimer = setTimeout(() => {
        if (battle) $("stump-sprite").dataset.pose = defaultStumpPose();
      }, 420);
    }
  }
  function openMenu() {
    let availableBackup = memoryBackup;
    try { availableBackup = availableBackup || localStorage.getItem(BACKUP); } catch {}
    $("undo-import").hidden = !availableBackup;
    updateFounderPictureHelp();
    $("menu-dialog").showModal();
  }
  function openDecor() {
    renderDecor();
    $("decor-dialog").showModal();
  }
  function openName(fromMenu = false) {
    if (schoolSession && state.selected === schoolSession.founder) { say('Change your original friend’s name and home on the Check-In screen.'); return; }
    nameFromMenu = fromMenu;
    $("nickname").value = state.pets[state.selected].nickname;
    $("name-dialog").showModal();
    $("nickname").focus();
  }
  function exportSave() {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download =
      "Checklings-Camp-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    $("import-message").textContent = "Save file ready. Check your downloads.";
  }
  function placeFriend(event) {
    const box = $("ground").getBoundingClientRect();
    if (event.detail !== 0) {
      positions[state.selected] = {
        x: Math.max(
          26,
          Math.min(77, 10 + ((event.clientX - box.left) / box.width) * 80),
        ),
        y: Math.max(
          48,
          Math.min(86, 16 + ((event.clientY - box.top) / box.height) * 80),
        ),
      };
      renderActors();
    }
    say(name() + " comes over.");
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const focused = button === document.activeElement;
    if (button.dataset.journalPage) { journalPage = button.dataset.journalPage === "goals" ? "goals" : "notes"; renderJournal(); return; }
    if (button.dataset.campGoal) { followCampGoal(button.dataset.campGoal); return; }
    if (button.dataset.view) {
      setView(button.dataset.view);
      return;
    }
    if (button.dataset.go) {
      setView(button.dataset.go);
      document.querySelector('[data-view="' + button.dataset.go + '"]').focus();
      return;
    }
    if (button.dataset.pet) {
      const id = button.dataset.pet;
      selectPet(id);
      if (focused) focusParty(id);
      return;
    }
    if (button.dataset.care) {
      act({ type: button.dataset.care });
      return;
    }
    if (button.dataset.stop !== undefined) {
      const index = +button.dataset.stop;
      act({ type: "stop", value: index });
      if (focused)
        document.querySelector('button[data-stop="' + index + '"]').focus();
      return;
    }
    if (button.dataset.decor) {
      const id = button.dataset.decor;
      act({ type: "unlock", id });
      if (focused)
        document.querySelector('button[data-decor="' + id + '"]').focus();
      return;
    }
    if (button.dataset.move) {
      move(button.dataset.move);
      return;
    }
    if (button.dataset.menuAction === "name") {
      $("menu-dialog").close();
      openName(true);
    }
  });
  $("weather").addEventListener("change", (event) =>
    act({ type: "weather", value: event.target.value }),
  );
  $("discover").onclick = () => act({ type: "discover" });
  $("ground").addEventListener("click", placeFriend);
  $("ground").addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const delta = {
      ArrowLeft: [-5, 0],
      ArrowRight: [5, 0],
      ArrowUp: [0, -5],
      ArrowDown: [0, 5],
    }[event.key];
    if (!delta) return;
    const p = positions[state.selected],
      x = Math.max(26, Math.min(77, p.x + delta[0])),
      y = Math.max(48, Math.min(86, p.y + delta[1]));
    if (x === p.x && y === p.y) return;
    event.preventDefault();
    positions[state.selected] = { x, y };
    renderActors();
  });
  $("open-menu").onclick = openMenu;
  $("open-decor").onclick = openDecor;
  $("menu-decor").onclick = () => {
    $("menu-dialog").close();
    openDecor();
  };
  $("rename").onclick = () => openName();
  $("cancel-name").onclick = () => $("name-dialog").close();
  const keepNickname = (event) => {
    event.preventDefault();
    act({ type: "rename", value: $("nickname").value });
    $("name-dialog").close();
  };
  $("name-form").onsubmit = keepNickname;
  if (schoolSession) {
    // Native form submission is intentionally disabled in the school sandbox.
    $("name-form").querySelector('[type="submit"]').onclick = keepNickname;
    $("nickname").onkeydown = event => { if (event.key === 'Enter') keepNickname(event); };
  }
  $("name-dialog").addEventListener("close", () => {
    if (nameFromMenu) $("open-menu").focus();
  });
  $("quiet-toggle").onclick = () => act({ type: "quiet" });
  $("export-save").onclick = exportSave;
  $("journal-export").onclick = exportSave;
  $("start-practice").onclick = startPractice;
  $("retry-practice").onclick = startPractice;
  $("leave-practice").onclick = () => {
    battle = null;
    clearTimeout(poseTimer);
    setView("home");
    say("Back at camp. Everyone’s okay.");
    document.querySelector('[data-view="home"]').focus();
  };
  $("import-file").addEventListener("change", async (event) => {
    const ticket = ++importTicket;
    pending = null;
    $("import-preview").hidden = true;
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 100000) {
      $("import-message").textContent =
        "That file is too big. Camp saves are under 100 KB.";
      return;
    }
    try {
      const candidate = E.hydrate(JSON.parse(await file.text()));
      if (ticket !== importTicket) return;
      pending = candidate;
      $("import-description").textContent =
        E.stamps(candidate) +
        " stamps. " +
        E.IDS.reduce((sum, id) => sum + candidate.pets[id].memories.length, 0) +
        " notes. Load this camp?";
      $("import-preview").hidden = false;
      $("import-message").textContent =
        "Save checked. Your camp hasn’t changed.";
    } catch {
      if (ticket !== importTicket) return;
      $("import-message").textContent =
        "That save won’t open. Your current camp is safe.";
    }
  });
  $("confirm-import").onclick = () => {
    if (!pending) return;
    memoryBackup = JSON.stringify(state);
    let durableBackup = false;
    try { localStorage.setItem(BACKUP, memoryBackup); durableBackup = !schoolSession; } catch {}
    state = pending;
    if (schoolSession) state.pets[schoolSession.founder].nickname = schoolSession.school.companion.pet.name;
    pending = null;
    importTicket++;
    battle = null;
    $("import-file").value = "";
    $("import-preview").hidden = true;
    $("undo-import").hidden = false;
    persist();
    render();
    $("import-message").textContent = durableBackup && storageOK
      ? "Camp loaded! Your previous camp has a safety copy."
      : "Camp loaded. Previous camp kept for this tab. Save to a file before closing.";
    say("Welcome back to camp!");
  };
  $("undo-import").onclick = () => {
    try {
      const previous = E.hydrate(JSON.parse(memoryBackup || localStorage.getItem(BACKUP)));
      memoryBackup = JSON.stringify(state);
      try { localStorage.setItem(BACKUP, memoryBackup); } catch {}
      state = previous;
      battle = null;
      pending = null;
      importTicket++;
      $("import-file").value = "";
      $("import-preview").hidden = true;
      persist();
      render();
      $("import-message").textContent = storageOK
        ? "Previous camp restored. The other camp is now the safety copy."
        : "Previous camp restored for this tab. Save to a file before closing.";
    } catch {
      $("import-message").textContent = "Safety copy won’t open. Your current camp is untouched.";
    }
  };
  const nameMenu = document.createElement("button");
  nameMenu.type = "button";
  nameMenu.dataset.menuAction = "name";
  nameMenu.innerHTML = item("book") + "<span>Nickname</span>";
  document.querySelector(".menu-actions").append(nameMenu);
  media.addEventListener("change", render);
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      state = E.hydrate(JSON.parse(event.newValue));
      battle = null;
      render();
      say("Camp updated from your other tab.");
    } catch {
      say("The other tab’s save won’t open. This camp is safe.");
    }
  });
  const stumpArt = $("stump-art"), stumpPicture = $("stump-picture-state");
  const stumpArtSource = stumpArt.getAttribute("src");
  let stumpArtRetries = 0;
  function setStumpPictureState(next) {
    const hadFocus = stumpPicture.contains(document.activeElement);
    $("stump-sprite").dataset.art = next;
    $("stump-sprite").setAttribute("aria-busy", String(next === "loading"));
    stumpArt.hidden = next !== "ready";
    stumpPicture.hidden = next === "ready" || view !== "practice" || !battle;
    $("retry-stump-art").hidden = next !== "error";
    $("stump-picture-message").textContent = next === "error" ? "The stump picture didn’t load." : next === "loading" ? "The stump picture is loading…" : "";
    if (!hadFocus || view !== "practice") return;
    if (next === "error") $("retry-stump-art").focus();
    if (next === "ready") {
      const target = battle ? battle.result ? $("retry-practice") : document.querySelector("[data-move]:not(:disabled)") : $("start-practice");
      if (target) target.focus();
    }
  }
  stumpArt.addEventListener("load", () => {
    if (stumpArt.complete && stumpArt.naturalWidth > 0) setStumpPictureState("ready");
  });
  stumpArt.addEventListener("error", () => {
    if (stumpArt.complete && stumpArt.naturalWidth === 0) setStumpPictureState("error");
  });
  $("retry-stump-art").onclick = () => {
    stumpArtRetries++;
    setStumpPictureState("loading");
    stumpPicture.focus();
    let source = stumpArtSource;
    if (!source.startsWith("data:")) {
      const url = new URL(source, document.baseURI);
      if (url.protocol === "https:" || url.protocol === "http:") {
        url.searchParams.set("art-retry", String(stumpArtRetries));
        source = url.href;
      }
    }
    stumpArt.removeAttribute("src");
    stumpArt.src = source;
  };
  setStumpPictureState(stumpArt.complete ? stumpArt.naturalWidth > 0 ? "ready" : "error" : "loading");

  render();
  if (storageOK) persist();
  else $("save-status").textContent = "Save to file";
  say(welcome);
})();

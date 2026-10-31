(async function () {
  "use strict";
  const school = globalThis.ChecklingSchool;
  const schoolSession = school ? await school.ready : null;
  // An isolated memory-only store prevents shared Chromebook account leakage.
  const ephemeral = new Map();
  const localStorage = school ? {getItem:key => ephemeral.get(key) || null,setItem:(key,value) => ephemeral.set(key,value)} : {getItem:key => window.localStorage.getItem(key),setItem:(key,value) => window.localStorage.setItem(key,value)};
  const E = globalThis.FirstTrail;
  const G = globalThis.CampGoals;
  // A school that has not been updated yet only stores version 1 camps; new features wait for it.
  const FULL = !schoolSession || (Array.isArray(schoolSession.formats) && schoolSession.formats.includes(2));
  const ADVENTURES = !schoolSession || schoolSession.formats?.includes(3);
  const VERSION = "6.3";
  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
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
    plannedRecipe = "",
    battle = null,
    practiceFounder = "mochi",
    pending = null,
    storageOK = true,
    memoryBackup = null,
    poseTimer,
    propTimer,
    nameFromMenu = false,
    importTicket = 0,
    practiceTier = 1,
    heartTimer;
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
  const autoRetried = new WeakSet();
  window.addEventListener('online', () => { const b = document.getElementById('school-save-retry'); if (b && !b.hidden) b.click(); });
  let schoolPaused = false, pauseDialog = null, pauseLeaveConfirmed = false;
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
    if (typeof schoolSession.access?.open === 'boolean') {
      pauseDialog = document.createElement('dialog');
      pauseDialog.id = 'school-pause-dialog';
      pauseDialog.setAttribute('aria-labelledby','school-pause-title');
      pauseDialog.setAttribute('aria-describedby','school-pause-copy');
      pauseDialog.setAttribute('closedby','none');
      pauseDialog.innerHTML = '<h2 id="school-pause-title">School camp is paused</h2><p id="school-pause-copy">Your teacher has paused play. Your current camp stays here while this school session is open. Save a file of unconfirmed progress before leaving. The usual shared-device timeout still applies.</p><p id="school-pause-status" role="status" aria-atomic="true"></p><div class="pause-actions"><button type="button" id="school-pause-export" autofocus>Save to file</button><button type="button" id="school-pause-check">Check again</button><button type="button" id="school-pause-leave">Return to Check-In</button></div>';
      document.body.append(pauseDialog);
      pauseDialog.addEventListener('cancel',event => {
        event.preventDefault();
        $('school-pause-status').textContent = 'Play is paused. Save your file, check again, or return to Check-In.';
      });
      $('school-pause-export').onclick = () => { exportSave(); $('school-pause-status').textContent = 'Save file ready. Check your downloads before leaving.'; };
      $('school-pause-check').onclick = async event => {
        event.currentTarget.disabled = true;
        $('school-pause-status').textContent = 'Checking with school…';
        try {
          const access = await school.request('access');
          setSchoolAccess(access);
          if (schoolPaused) $('school-pause-status').textContent = 'School play is still paused. Your camp has been kept here.';
        } catch { $('school-pause-status').textContent = 'School could not answer. Your camp is still here; save a file before leaving.'; }
        finally { $('school-pause-check').disabled = false; }
      };
      $('school-pause-leave').onclick = () => {
        if ((schoolQueued || schoolFlight || schoolFailed) && !pauseLeaveConfirmed) {
          pauseLeaveConfirmed = true;
          $('school-pause-status').textContent = 'Some progress is not confirmed at school. Save a file first, or choose Leave without unconfirmed progress.';
          $('school-pause-leave').textContent = 'Leave without unconfirmed progress';
          return;
        }
        school.close();
      };
      addEventListener('checkling-school-access',event => setSchoolAccess(event.detail));
      document.addEventListener('click',event => {
        if (schoolPaused && !pauseDialog.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); if (!pauseDialog.open) pauseDialog.showModal(); }
      },true);
    }
  }
  function setSchoolAccess(access) {
    if (!pauseDialog || typeof access?.open !== 'boolean') return;
    const wasPaused = schoolPaused;
    schoolPaused = !access.open;
    if (schoolPaused) {
      if (!wasPaused) {
        pauseLeaveConfirmed = false;
        $('school-pause-leave').textContent = 'Return to Check-In';
      }
      // Close other dialogs before opening this one; the underlying camp stays in memory.
      document.querySelectorAll('dialog[open]').forEach(dialog => { if (dialog !== pauseDialog) dialog.close(); });
      if (!pauseDialog.open) pauseDialog.showModal();
    } else if (wasPaused) {
      pauseDialog.close();
      $('actions').focus();
      say('Your teacher reopened school camp. Continuing with your current progress.');
      if (schoolFailed && !schoolFlight) { schoolFlight = schoolFailed; schoolFailed = null; flushSchoolSave(); }
      else if (!schoolFlight && schoolQueued) flushSchoolSave();
    }
  }
  const schoolMutation = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),byte => byte.toString(16).padStart(2,'0')).join('');
  async function flushSchoolSave() {
    if (schoolPaused) return;
    if (!schoolFlight && schoolQueued) { schoolFlight = {camp:schoolQueued,expectedRevision:schoolRevision,mutationId:schoolMutation()}; schoolQueued = null; }
    if (!schoolFlight) return;
    const flight = schoolFlight;
    $('save-status').textContent = 'Saving to school…';
    $('school-save-retry').hidden = true;
    try {
      const saved = await school.request('save',flight);
      schoolRevision = saved.revision;
      schoolFlight = null;
      // An older save acknowledgement cannot resume a newer observed pause.
      if (saved.access?.open === false) setSchoolAccess(saved.access);
      if (schoolQueued && !schoolPaused) return flushSchoolSave();
      $('save-status').textContent = schoolQueued ? 'Not saved to school' : 'Saved to school';
    } catch (error) {
      schoolFailed = flight; schoolFlight = null;
      $('save-status').textContent = 'Not saved to school';
      $('school-save-retry').hidden = false;
      // School Wi-Fi drops for a second all the time, so try once more on our own before asking the student.
      if (!autoRetried.has(flight)) { autoRetried.add(flight); setTimeout(() => { if (schoolFailed === flight) $('school-save-retry').click(); }, 4000); }
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
      schoolQueued = ADVENTURES ? E.hydrate(state) : FULL ? E.toV2(state) : E.toV1(state);
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
    if (action.type === "forage") return result.message;
    if (action.type === "unlock")
      return E.DECOR.find((d) => d.id === action.id).name + " placed!";
    if (action.type === "quiet")
      return effectiveQuiet()
        ? "Quiet sprites on. Same game."
        : "A little wiggle is back.";
    return result.message;
  }
  function act(action) {
    if (schoolPaused) return;
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
    if (result.bondUp) showBondUp(result.bondUp);
    return result;
  }
  function setView(next) {
    if (!["home", "trail", "practice", "journal"].includes(next)) return;
    view = next;
    // A finished spar stays on screen only until you leave; coming back shows the ladder.
    if (next === "practice" && battle && battle.result) { battle = null; clearTimeout(poseTimer); }
    if (next === "practice" && !battle) practiceTier = highestTier();
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
    practiceTier = highestTier(id);
    if (view === "practice" && !battle) renderTiers();
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
    const bond = state.pets[active].bond, level = E.bondLevel(bond), nextLevel = E.BOND_LEVELS[level + 1];
    $("bond-level").innerHTML = item("heart") + "<span>" + E.BOND_LEVELS[level].name + "</span><small>" + (nextLevel ? nextLevel.at - bond + " bond to " + nextLevel.name.toLowerCase() : "Max friendship") + "</small>";
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
      (E.DECOR.some((d) => d.id === state.equipped) ? state.equipped : "planter");
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
          "</small>" +
          (FULL ? '<small class="forage-tag" data-ready="' + E.forageOpen(state, today(), index) + '">' + (E.forageOpen(state, today(), index) ? "Forage ready" : "Foraged today") + "</small>" : "") +
          "</span></button>",
      )
      .join("");
    $("discover-label").textContent = trailActions[state.selected][state.stop];
    const open = FULL && E.forageOpen(state, today());
    $("forage").hidden = !FULL;
    $("forage").setAttribute("aria-disabled", String(!open));
    $("forage-label").textContent = open ? "Forage" : "Foraged";
    $("forage-cost").textContent = open ? E.FORAGE_ENERGY + " energy" : "Tomorrow";
  }
  function renderDecor() {
    $("decor-stamps").textContent = E.stamps(state) + " trail stamps";
    $("decor-items").innerHTML = E.DECOR.filter((d, index) => FULL || index < 3).map((d) => {
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
    return !!next && ((next.kind === "care" && next.action === "play" && state.pets[next.pet].energy < 25) || (next.kind === "trail" && state.pets[next.pet].energy < 18) || (next.kind === "forage" && state.pets[state.selected].energy < E.FORAGE_ENERGY));
  }
  function goalHint(next) {
    if (!next) return "All set!";
    if (goalNeedsRest(next)) return "Rest with " + name(next.pet) + (next.kind === "trail" ? " before exploring." : " before playing.");
    if (next.kind === "journeys") return "Follow a founder’s story, one chapter at a time.";
    if (next.kind === "workshop") return "Gather supplies and build something for camp.";
    if (next.kind === "care") return ({ feed: "Feed ", play: "Play with ", clean: "Brush ", rest: "Rest with ", observe: "Hang out with " }[next.action]) + name(next.pet) + ".";
    if (next.kind === "trail") return "Explore " + ["Seed Gate", "Old Waterwheel", "Star Pond"][next.stop] + " with " + name(next.pet) + ".";
    if (next.kind === "practice") return (next.tier > 1 ? "Take on the " + E.TIERS[next.tier - 1].name.toLowerCase() : "Lead a practice") + " with " + name(next.pet) + ".";
    if (next.kind === "forage") return next.stop === null ? "Foraged everywhere today. New curios tomorrow." : "Forage at " + ["Seed Gate", "Old Waterwheel", "Star Pond"][next.stop] + " today.";
    return "Place the " + E.DECOR.find(d => d.id === next.id).name.toLowerCase() + ".";
  }
  function renderCampGoals() {
    const goals = G.read(state, { full: FULL, adventures: ADVENTURES, today: today() });
    $("camp-goals-summary").textContent = goals.complete ? "Camp goals complete. Kettle Creek feels like home!" : goals.completedTracks + " / " + goals.tracks.length + " camp goals complete. Take it at your own pace.";
    $("camp-goals-list").innerHTML = goals.tracks.map(track => '<div class="camp-goal-row" data-goal-row="' + track.id + '">' + item(track.icon) + '<div class="camp-goal-copy"><div class="camp-goal-heading"><h3>' + track.title + '</h3><strong>' + track.done + ' / ' + track.total + '</strong></div><p>' + escape(goalHint(track.next)) + '</p><progress value="' + track.done + '" max="' + track.total + '" aria-label="' + track.title + ' ' + track.done + ' out of ' + track.total + '">' + track.done + '/' + track.total + '</progress></div><button type="button" data-camp-goal="' + track.id + '" aria-label="' + track.title + (track.next ? ' next task' : ' complete') + '" ' + (track.next && !(track.next.kind === 'forage' && track.next.stop === null) ? '' : 'disabled') + '>' + (track.next ? track.next.kind === 'forage' && track.next.stop === null ? 'Tomorrow' : 'Next' : 'Done') + '</button></div>').join("");
  }
  function followCampGoal(id) {
    const track = G.read(state, { full: FULL, adventures: ADVENTURES, today: today() }).tracks.find(track => track.id === id), next = track && track.next;
    if (!next) return;
    if (next.kind === "journeys") { openJourneys(); return; }
    if (next.kind === "workshop") { openWorkshop(); return; }
    if (next.kind === "practice" && battle && !battle.result) {
      setView("practice"); say("Finish this spar first. Your next friend can go after.");
      (document.querySelector('[data-move="guard"]:not(:disabled)') || document.querySelector('.party-button:not(:disabled)')).focus(); return;
    }
    if (next.kind === "decor") { setView("home"); openDecor(); return; }
    if (next.kind === "forage") {
      if (next.stop === null) return;
      act({ type: "stop", value: next.stop }); setView("trail"); say(goalHint(next));
      (goalNeedsRest(next) ? document.querySelector('#trail-actions [data-care="rest"]') : $("forage")).focus(); return;
    }
    if (next.kind === "practice") { battle = null; clearTimeout(poseTimer); }
    act({ type: "select", id: next.pet });
    if (next.kind === "care") { setView("home"); say(goalHint(next)); document.querySelector('#care-actions [data-care="' + (goalNeedsRest(next) ? 'rest' : next.action) + '"]').focus(); }
    if (next.kind === "trail") { act({ type: "stop", value: next.stop }); setView("trail"); say(goalHint(next)); (goalNeedsRest(next) ? document.querySelector('#trail-actions [data-care="rest"]') : $("discover")).focus(); }
    if (next.kind === "practice") { practiceTier = next.tier || 1; setView("practice"); say(goalHint(next)); $("start-practice").focus(); }
  }

  function renderJournal() {
    const p = state.pets[state.selected];
    const goalsPage = journalPage === "goals", shelfPage = journalPage === "curios", journeyPage = journalPage === "journeys", guidePage = journalPage === "guide";
    $("journey-book").hidden = !journeyPage;
    if(journeyPage) renderJourneys();
    $("founder-guide").hidden = !guidePage;
    if(guidePage) renderGuide();
    $("journal-notes").hidden = goalsPage || shelfPage || journeyPage || guidePage; $("camp-goals").hidden = !goalsPage; $("curio-shelf").hidden = !shelfPage;
    for (const tab of document.querySelectorAll("[data-journal-page]")) tab.setAttribute("aria-pressed", String(tab.dataset.journalPage === journalPage));
    $("journal-title").textContent = guidePage ? "Founder field guide" : journeyPage ? "Founder journeys" : goalsPage ? "Camp goals" : shelfPage ? "Curio shelf" : name() + "’s notes";
    if (goalsPage) renderCampGoals();
    if (shelfPage) renderShelf();
    $("journal-friend").textContent = name();
    $("journal-art").src = art(state.selected, true);
    $("journal-art").alt = name();
    $("journal-progress").textContent = p.discoveries.length + "/3 discoveries";
    $("practice-badge").hidden = !p.battles;
    $("practice-badge").innerHTML = item("badge") + (FULL ? "Practice badges " + p.battles + "/3" : "Practice badge");
    $("journal-empty").hidden = p.memories.length > 0;
    $("journal-entries").innerHTML = p.memories
      .slice()
      .reverse()
      .map(
        (m) =>
          '<li data-kind="' +
          (m.id.startsWith("find") || m.id.startsWith("curio") ? "find" : m.id.startsWith("bond") ? "bond" : "memory") +
          '">' +
          escape(m.id === "practice" ? "Practice with the sapling stump. Everyone’s okay." : m.text) +
          "</li>",
      )
      .join("");
  }
  function defaultStumpPose() {
    if (!battle) return "0";
    if (battle.result) return battle.result === "win" ? "3" : "0";
    const intent = E.intentFor(battle);
    if (intent.armor || (!intent.damage && !intent.drain && /cool/i.test(intent.name))) return "1";
    if (intent.damage * (intent.hits || 1) >= 20 || /wind/i.test(intent.name)) return "2";
    return "0";
  }
  function highestTier(id = state.selected) {
    return FULL ? Math.min(3, state.pets[id].battles + 1) : 1;
  }
  function renderTiers() {
    const top = highestTier();
    if (practiceTier > top) practiceTier = top;
    const tier = E.TIERS[practiceTier - 1];
    $("tier-picker").hidden = !FULL || view !== "practice" || !!battle;
    $("tier-picker").innerHTML = E.TIERS.map((t) => {
      const locked = t.tier > top, cleared = state.pets[state.selected].battles >= t.tier;
      return '<button type="button" data-tier="' + t.tier + '" aria-pressed="' + (t.tier === practiceTier) + '"' + (locked ? ' aria-disabled="true"' : "") + '><strong>' + t.name.replace(" Stump", "") + "</strong><small>" + (cleared ? "Badge earned" : locked ? "Locked" : t.hp + " HP") + "</small></button>";
    }).join("");
    $("practice-welcome").querySelector("h2").textContent = tier.name.toUpperCase();
    $("practice-welcome").querySelector("p").innerHTML = ["Watch its next move.<br>Guard big hits. Find your opening.", "Roots drain stamina.<br>Guard the snare and the big swing.", "Bark armor, double swipes, a crushing blow.<br>Switch friends before you run out."][practiceTier - 1];
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
    if (inPractice && !battle) renderTiers();
    else $("tier-picker").hidden = true;
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
    document.querySelector(".enemy-hud > strong").textContent = E.TIERS[battle.tier - 1].name.toUpperCase();
    $("enemy-hp").max = battle.enemyMax;
    $("enemy-hp").value = battle.enemy;
    $("enemy-hp-text").textContent = battle.enemy + "/" + battle.enemyMax;
    $("stump-sprite").dataset.tier = battle.tier;
    $("enemy-intent").textContent = battle.result
      ? "DONE"
      : E.intentFor(battle).short;
    $("enemy-intent").title = battle.result ? "" : E.intentFor(battle).detail;
    $("stump-sprite").dataset.pose = defaultStumpPose();
    for (const button of document.querySelectorAll("[data-move]"))
      button.disabled =
        !!battle.result ||
        p.hp === 0 ||
        (button.dataset.move === "strike" && p.stamina < 3) ||
        (button.dataset.move === "signature" && p.stamina < 5);
    $("practice-result").hidden = !battle.result;
    $("next-stump").hidden = !(FULL && battle.result === "win" && battle.tier < 3 && highestTier(practiceFounder) > battle.tier);
    $("result-title").textContent =
      battle.result === "win" ? "PRACTICE CLEAR!" : "GOOD TRY!";
    $("result-copy").textContent =
      battle.result === "win"
        ? name(practiceFounder) + " earned the " + E.TIERS[battle.tier - 1].name.toLowerCase() + " badge. Everyone’s okay!"
        : "Everyone’s okay. Watch NEXT and guard the big ones.";
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
          : "KETTLE CREEK";
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
    renderAdventure();
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
    if (schoolPaused) return;
    practiceFounder = state.selected;
    if (practiceTier > highestTier(practiceFounder)) practiceTier = highestTier(practiceFounder);
    battle = E.startBattle(practiceFounder, practiceTier);
    clearTimeout(poseTimer);
    render();
    say(E.TIERS[battle.tier - 1].name + ": " + E.intentFor(battle).detail + " What’s your move?");
    document.querySelector('[data-move="strike"]').focus();
  }
  function move(type, id) {
    if (schoolPaused) return;
    if (!battle) return;
    const beforeEnemy = battle.enemy,
      result = E.battleMove(battle, type, id);
    battle = result.battle;
    if (result.changed && battle.result === "win") {
      const selected = state.selected;
      state.selected = practiceFounder;
      const reward = E.dispatch(state, { type: "battle-win", tier: battle.tier });
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
    (schoolPaused && pauseDialog ? pauseDialog : document.body).append(link);
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
    if (button.dataset.journalPage) { journalPage = ["goals", "curios", "journeys", "guide"].includes(button.dataset.journalPage) ? button.dataset.journalPage : "notes"; renderJournal(); return; }
    if (button.dataset.guideAction) { followGuide(button.dataset.guideFounder,button.dataset.guideAction); return; }
    if (button.dataset.tier) {
      if (button.getAttribute("aria-disabled") === "true") { say("Clear the " + E.TIERS[button.dataset.tier - 2].name.toLowerCase() + " with " + name() + " first."); return; }
      practiceTier = +button.dataset.tier; renderTiers(); say(E.TIERS[practiceTier - 1].name + " is ready.");
      if (focused) document.querySelector('[data-tier="' + practiceTier + '"]').focus();
      return;
    }
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
      const raw = JSON.parse(await file.text());
      if (!ADVENTURES && raw.version === 3) {
        if (ticket !== importTicket) return;
        $('import-message').textContent = 'Your school camp is updating. Keep this journey save and try again after reopening camp. Your current camp is unchanged.';
        return;
      }
      const candidate = E.hydrate(raw);
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
  function showBondUp(up) {
    const level = E.BOND_LEVELS[up.level];
    say(name(up.pet) + " is now your " + level.name.toLowerCase() + "! A new journal note.");
    clearTimeout(heartTimer);
    if (view !== "home") return;
    const p = positions[up.pet];
    $("bond-heart").style.left = p.x + 2 + "%";
    $("bond-heart").style.top = p.y - 20 + "%";
    $("bond-heart").hidden = false;
    heartTimer = setTimeout(() => ($("bond-heart").hidden = true), effectiveQuiet() ? 1600 : 2400);
  }
  function renderShelf() {
    const owned = new Set(state.curios), day = today();
    $("curio-summary").textContent = owned.size + " / " + E.CURIOS.length + " curios. Each trail stop has one new curio a day.";
    $("curio-today").innerHTML = E.STOPS.map((stop, index) => {
      const open = E.forageOpen(state, day, index), c = E.curioFor(day, index);
      return '<li><strong>' + ["Seed Gate", "Old Waterwheel", "Star Pond"][index] + ":</strong> " + (open ? "something is waiting. Go forage!" : "you found the " + escape(c.name.toLowerCase()) + " today.") + "</li>";
    }).join("");
    $("curio-grid").innerHTML = E.CURIOS.map((c) => {
      const has = owned.has(c.id);
      return '<li class="curio-card" data-owned="' + has + '" data-rarity="' + c.rarity + '"><span class="curio" style="background-position:' + (c.cell % 4) * 33.333333 + "% " + Math.floor(c.cell / 4) * 33.333333 + '%" aria-hidden="true"></span><strong>' + (has ? escape(c.name) : "???") + "</strong><small>" + ["Seed Gate", "Waterwheel", "Star Pond"][c.stop] + " · " + c.rarity + "</small>" + (has ? "<p>" + escape(c.note) + "</p>" : "") + "</li>";
    }).join("");
  }
  function openJourneys() {
    journalPage = 'journeys'; setView('journal'); $('journal-view').focus();
  }
  function openWorkshop() {
    renderWorkshop(); $('workshop-dialog').showModal();
  }
  function showRecipe(id) {
    openWorkshop(); const card=document.querySelector('[data-recipe="'+id+'"]');
    (card.querySelector('[data-craft]:enabled')||card.querySelector('[data-build-plan]')||card.querySelector('[data-recipe-story]')).focus();
  }
  function recipeSupplies(recipe) {
    return Object.entries(recipe.cost).map(([id,need])=>({ ...E.MATERIALS.find(m=>m.id===id),need,have:state.materials[id],missing:Math.max(0,need-state.materials[id]) }));
  }
  function supplyProgress(recipe) {
    return '<ul class="recipe-supplies">'+recipeSupplies(recipe).map(m=>'<li data-material="'+m.id+'"><span>'+m.name+'</span><strong>Have '+m.have+' / Need '+m.need+'</strong><progress value="'+Math.min(m.have,m.need)+'" max="'+m.need+'" aria-label="'+recipe.name+': '+m.name+' '+Math.min(m.have,m.need)+' out of '+m.need+'"></progress><small>'+(m.missing?m.missing+' to find':'Enough for this build')+'</small></li>').join('')+'</ul>';
  }
  function followBuildPlan() {
    const recipe=E.RECIPES.find(r=>r.id===plannedRecipe); if(schoolPaused||!ADVENTURES||!recipe)return;
    if($('workshop-dialog').open)$('workshop-dialog').close();
    if(battle&&!battle.result){setView('practice');say('Finish this friendly spar or leave it before following your build plan.');$('leave-practice').focus();return;}
    if(recipe.founder&&state.journeys[recipe.founder]<3){plannedRecipe='';followJourney(recipe.founder);return;}
    if(state.crafted.includes(recipe.id)){plannedRecipe='';setView('home');say(recipe.name+' is built. Your keepsake is ready at camp.');$('open-workshop').focus();return;}
    const missing=recipeSupplies(recipe).find(m=>m.missing);
    if(!missing){showRecipe(recipe.id);return;}
    if(state.stop!==missing.stop)act({type:'stop',value:missing.stop});
    setView('trail');
    const tired=state.pets[state.selected].energy<15;
    say(tired?'Take a free rest, then gather for your '+recipe.name.toLowerCase()+'.':'Gather '+missing.name.toLowerCase()+' for your '+recipe.name.toLowerCase()+'.');
    (tired?document.querySelector('#trail-actions [data-care=rest]'):$('gather')).focus();
  }
  function renderBuildPlan() {
    const recipe=E.RECIPES.find(r=>r.id===plannedRecipe),panel=$('build-plan');
    if(recipe?.founder&&state.journeys[recipe.founder]<3)plannedRecipe='';
    panel.hidden=!ADVENTURES||view!=='trail'||!recipe||!plannedRecipe; if(panel.hidden)return;
    const built=state.crafted.includes(recipe.id),missing=recipeSupplies(recipe).find(m=>m.missing);
    $('build-plan-title').textContent=recipe.name+' build plan';
    $('build-plan-supplies').innerHTML=built?'<p>Built! Your supplies were used once. Place it again for free.</p>':supplyProgress(recipe);
    $('build-plan-status').textContent=built?'Keepsake built.':!missing?'All supplies ready. Open the workshop to build.':state.pets[state.selected].energy<15?'A free rest will get you ready to gather.':missing.stop===state.stop?'Choose Gather '+['wood','stones','reeds'][state.stop]+', then follow the plan to the next supply.':'Next: '+missing.name.toLowerCase()+' at '+E.STOPS[missing.stop].name+'.';
    $('build-plan-next').textContent=built?'See in camp':!missing?'Open workshop':state.pets[state.selected].energy<15?'Rest for free':'Find '+missing.name.toLowerCase();
    $('build-plan-workshop').hidden=built||!missing;
  }
  function costText(recipe) {
    return Object.entries(recipe.cost).map(([id,n]) => n + ' ' + E.MATERIALS.find(m=>m.id===id).name.toLowerCase()).join(' · ');
  }
  function craftItem(recipe) {
    const index=E.RECIPES.findIndex(r=>r.id===recipe.id);
    return '<span class="craft-sprite" style="background-position:'+(index%4)*100/3+'% '+Math.floor(index/4)*100+'%" aria-hidden="true"></span>';
  }
  function journeyHint(id, status) {
    const next=status.next;
    if(status.complete){const keepsake=E.RECIPES.find(r=>r.founder===id);return state.crafted.includes(keepsake.id)?keepsake.name+' is built. Place it in camp any time, for free.':'Journey complete. Its special keepsake is waiting in the workshop.';}
    if(!next)return 'Choose how this chapter unfolds. 8 energy · 3 supplies · a new memory.';
    if(next.kind==='trail')return 'First, explore ' + E.STOPS[next.stop].name.toLowerCase() + ' with ' + name(id) + '.';
    if(next.kind==='craft')return 'Build the ' + E.RECIPES.find(r=>r.id===next.id).name.toLowerCase() + ' in the workshop.';
    if(next.kind==='friendship')return 'Reach Pal friendship: ' + state.pets[id].bond + ' / 25 bond. Share care, a meal or a little play.';
    if(next.kind==='rest')return name(id) + ' needs a free rest first.';
    return 'Visit ' + E.STOPS[next.stop].name.toLowerCase() + ' with ' + name(id) + '.';
  }
  function followJourney(id) {
    if(!ADVENTURES)return;
    if(battle&&!battle.result){setView('practice');say('Finish this friendly spar or leave it before heading out.');$('leave-practice').focus();return;}
    selectPet(id);
    const status=E.journeyStatus(state,id),next=status.next;
    if(status.complete){showRecipe(E.RECIPES.find(r=>r.founder===id).id);return;}
    if(next?.kind==='craft'){showRecipe(next.id);return;}
    if(next?.kind==='friendship'||next?.kind==='rest'){
      setView('home');say(journeyHint(id,status));document.querySelector('#care-actions [data-care="'+(next.kind==='rest'?'rest':'play')+'"]').focus();return;
    }
    act({type:'stop',value:status.done});setView('trail');say(journeyHint(id,E.journeyStatus(state,id)));
    if(next?.kind==='trail'){
      (state.pets[id].energy<18?document.querySelector('#trail-actions [data-care=rest]'):$('discover')).focus();
    }else $('journey-scene').focus();
  }
  function renderJourneys() {
    $('journey-summary').textContent=E.IDS.reduce((n,id)=>n+state.journeys[id],0)+' / 12 chapters shared. No time limit. Both choices are good paths.';
    $('journey-cards').innerHTML=E.IDS.map(id=>{
      const story=E.JOURNEYS[id],status=E.journeyStatus(state,id);
      const built=state.crafted.includes(E.RECIPES.find(r=>r.founder===id).id);
      return '<article class="journey-card" data-story="'+id+'"><img src="'+art(id,true)+'" alt="" width="80" height="80"><div><p class="section-label">'+escape(name(id))+' · '+status.done+'/3</p><h3>'+story.title+'</h3><p>'+escape(status.complete?'All three chapters are in your journal.':status.chapter.title)+'</p><progress max="3" value="'+status.done+'" aria-label="'+escape(name(id))+' journey '+status.done+' out of 3"></progress><p>'+escape(journeyHint(id,status))+'</p><button type="button" data-journey-go="'+id+'">'+(status.complete?built?'Place keepsake':'Build keepsake':'Next chapter')+'</button></div></article>';
    }).join('');
  }
  function renderWorkshop() {
    $('workshop-supplies').textContent=E.MATERIALS.map(m=>m.name+': '+state.materials[m.id]).join(' · ');
    $('workshop-recipes').innerHTML=E.RECIPES.map(r=>{
      const owned=state.crafted.includes(r.id),ready=E.canCraft(state,r.id),placed=state.equippedCraft===r.id,locked=r.founder&&state.journeys[r.founder]<3;
      return '<article class="recipe-card" data-recipe="'+r.id+'">'+craftItem(r)+'<h3>'+r.name+'</h3><p>'+r.note+'</p><small>'+escape(owned?'Built! No supplies needed to place it again.':locked?'Finish '+E.SPECIES[r.founder].name+'’s journey first.':costText(r))+'</small>'+(!owned?supplyProgress(r):'')+'<div class="recipe-actions"><button type="button" data-craft="'+r.id+'" '+(!owned&&!ready?'disabled':'')+' aria-pressed="'+placed+'">'+(placed?'Placed':owned?'Place in camp':'Build')+'</button>'+(!owned?(locked?'<button type="button" data-recipe-story="'+r.founder+'">Follow '+E.SPECIES[r.founder].name+'’s journey</button>':!ready?'<button type="button" data-build-plan="'+r.id+'" aria-label="Plan supplies for '+r.name+'">Plan supplies</button>':''):'')+'</div></article>';
    }).join('');
  }
  function renderAdventure() {
    $('adventure-doors').hidden=!ADVENTURES||view!=='home';
    $('gather').hidden=!ADVENTURES;
    $('journey-scene').hidden=!ADVENTURES||view!=='trail';
    const placed=E.RECIPES.find(r=>r.id===state.equippedCraft);
    $('crafted-keepsake').hidden=!ADVENTURES||view!=='home'||!placed;
    if(placed){$('crafted-keepsake').innerHTML=craftItem(placed)+'<span>'+placed.name+'</span>';}
    renderBuildPlan();
    if(!ADVENTURES)return;
    $('gather-label').textContent='Gather '+['wood','stones','reeds'][state.stop];
    if(view==='trail'){
      const story=E.JOURNEYS[state.selected],status=E.journeyStatus(state);
      $('journey-scene-title').textContent=story.title;
      $('journey-scene-copy').textContent=status.complete?journeyHint(state.selected,status):status.chapter.title+' · '+status.chapter.text;
      $('journey-scene-hint').textContent=journeyHint(state.selected,status);
      $('journey-choices').innerHTML=!status.complete&&status.ready?status.chapter.choices.map((c,i)=>'<button type="button" data-journey-choice="'+i+'" data-chapter="'+status.done+'">'+escape(c)+'</button>').join(''):'';
      $('journey-next').hidden=status.ready===true;$('journey-next').textContent=status.complete?'Open workshop':'Next step';
    }
    if($('workshop-dialog').open)renderWorkshop();
  }
  function buildAdventures() {
    const doors=document.createElement('div');doors.id='adventure-doors';doors.className='adventure-doors';doors.hidden=!ADVENTURES;
    doors.innerHTML='<button type="button" id="open-journeys">'+item('book')+'<span>Founder journeys</span><small>Four stories to share</small></button><button type="button" id="open-workshop">'+item('bag')+'<span>Workshop</span><small>Gather · build · keep</small></button>';
    $('actions').after(doors);
    const gather=document.createElement('button');gather.type='button';gather.id='gather';gather.innerHTML=item('bag')+'<span id="gather-label">Gather supplies</span><small>15 energy · 3 supplies</small>';$('forage').after(gather);
    const scene=document.createElement('section');scene.id='journey-scene';scene.className='journey-scene panel';scene.hidden=true;scene.tabIndex=-1;scene.setAttribute('aria-labelledby','journey-scene-title');
    scene.innerHTML='<p class="section-label">A FOUNDER JOURNEY</p><h2 id="journey-scene-title"></h2><p id="journey-scene-copy"></p><p id="journey-scene-hint"></p><div id="journey-choices" class="journey-choices"></div><button type="button" id="journey-next">Next step</button>';
    doors.after(scene);
    const plan=document.createElement('section');plan.id='build-plan';plan.className='build-plan panel';plan.hidden=true;plan.setAttribute('aria-labelledby','build-plan-title');
    plan.innerHTML='<p class="section-label">MAKE IT YOURS</p><h2 id="build-plan-title"></h2><div id="build-plan-supplies"></div><p id="build-plan-status" role="status" aria-atomic="true"></p><div class="build-plan-actions"><button type="button" id="build-plan-next">Next supply</button><button type="button" id="build-plan-workshop">Back to workshop</button><button type="button" id="build-plan-clear">Put plan away</button></div>';
    scene.before(plan);
    const tab=document.createElement('button');tab.type='button';tab.dataset.journalPage='journeys';tab.hidden=!ADVENTURES;tab.setAttribute('aria-pressed','false');tab.innerHTML=item('book')+'Journeys';document.querySelector('.journal-page-buttons').append(tab);
    const book=document.createElement('section');book.id='journey-book';book.hidden=true;book.innerHTML='<p id="journey-summary"></p><div id="journey-cards" class="journey-cards"></div>';$('camp-goals').after(book);
    const workshop=document.createElement('dialog');workshop.id='workshop-dialog';workshop.className='panel workshop-dialog';workshop.setAttribute('aria-labelledby','workshop-title');
    workshop.innerHTML='<button type="button" id="close-workshop" autofocus>Close workshop</button><p class="section-label">MAKE SOMETHING SMALL</p><h2 id="workshop-title">CAMP WORKSHOP</h2><p id="workshop-supplies" class="workshop-supplies"></p><p>Gather fallen wood at the seed gate, smooth stones at the waterwheel and reeds at the pond. Rest is free. Keepsakes decorate camp.</p><div class="supply-trips">'+E.MATERIALS.map((m,i)=>'<button type="button" data-supply-stop="'+i+'">Gather '+m.name.toLowerCase()+'</button>').join('')+'</div><p id="workshop-message" role="status" aria-atomic="true"></p><div id="workshop-recipes" class="workshop-recipes"></div>';
    document.body.append(workshop);
    const keepsake=document.createElement('div');keepsake.id='crafted-keepsake';keepsake.className='crafted-keepsake';keepsake.hidden=true;$('world').append(keepsake);
    $('open-journeys').onclick=openJourneys;$('open-workshop').onclick=openWorkshop;$('close-workshop').onclick=()=>workshop.close();
    $('journey-next').onclick=()=>followJourney(state.selected);
    $('gather').onclick=()=>act({type:'gather'});
    $('build-plan-next').onclick=followBuildPlan;
    $('build-plan-workshop').onclick=()=>showRecipe(plannedRecipe);
    $('build-plan-clear').onclick=()=>{plannedRecipe='';renderBuildPlan();$('gather').focus();say('Build plan put away. Your supplies are unchanged.');};
    document.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b||!ADVENTURES)return;
      if(b.dataset.buildPlan){plannedRecipe=b.dataset.buildPlan;followBuildPlan();}
      if(b.dataset.recipeStory){workshop.close();followJourney(b.dataset.recipeStory);}
      if(b.dataset.journeyGo)followJourney(b.dataset.journeyGo);
      if(b.dataset.journeyChoice!==undefined){
        const result=act({type:'journey',chapter:Number(b.dataset.chapter),choice:Number(b.dataset.journeyChoice)});
        if(result.changed){$('journey-scene').focus();}
      }
      if(b.dataset.supplyStop!==undefined){
        workshop.close();act({type:'stop',value:Number(b.dataset.supplyStop)});setView('trail');say('Gather supplies here. Rest any time.');
        (state.pets[state.selected].energy<15?document.querySelector('#trail-actions [data-care=rest]'):$('gather')).focus();
      }
      if(b.dataset.craft){
        const id=b.dataset.craft,result=act({type:state.crafted.includes(id)?'place-craft':'craft',id});
        $('workshop-message').textContent=result.message;document.querySelector('[data-craft="'+id+'"]').focus();
      }
    });
  }

  (function buildFive() {
    document.querySelector('.playtest-tag').textContent = schoolSession ? 'PIXEL CAMP · SCHOOL CAMP' : 'PIXEL CAMP · OPEN CAMP';
    document.querySelector('.about-playtest summary').textContent = 'About Pixel Camp';
    document.querySelector(".about-playtest p").textContent = "Pixel Camp " + VERSION;
    const bond = document.createElement("p");
    bond.id = "bond-level"; bond.className = "bond-level";
    $("pet-region").after(bond);
    const heart = document.createElement("div");
    heart.id = "bond-heart"; heart.className = "care-prop item i-heart bond-heart"; heart.hidden = true; heart.setAttribute("aria-hidden", "true");
    $("care-prop").after(heart);
    const forage = document.createElement("button");
    forage.type = "button"; forage.id = "forage";
    forage.innerHTML = item("bag") + '<span id="forage-label">Forage</span><small id="forage-cost"></small>';
    $("discover").after(forage);
    const nextStump = document.createElement("button");
    nextStump.type = "button"; nextStump.id = "next-stump"; nextStump.hidden = true; nextStump.textContent = "Next stump";
    $("retry-practice").after(nextStump);
    const tiers = document.createElement("div");
    tiers.id = "tier-picker"; tiers.className = "tier-picker"; tiers.setAttribute("role", "group"); tiers.setAttribute("aria-label", "Choose a stump");
    $("route-stops").after(tiers);
    const shelfTab = document.createElement("button");
    shelfTab.type = "button"; shelfTab.dataset.journalPage = "curios"; shelfTab.setAttribute("aria-pressed", "false"); shelfTab.hidden = !FULL;
    shelfTab.innerHTML = item("shelf") + "Curio shelf";
    document.querySelector(".journal-page-buttons").append(shelfTab);
    const shelf = document.createElement("section");
    shelf.id = "curio-shelf"; shelf.className = "curio-shelf"; shelf.hidden = true; shelf.setAttribute("aria-label", "Curio shelf");
    shelf.innerHTML = '<p id="curio-summary" role="status" aria-atomic="true"></p><ul id="curio-today" class="curio-today"></ul><ul id="curio-grid" class="curio-grid"></ul><button type="button" data-go="trail">' + item("map") + "<span>Go forage</span></button>";
    $("camp-goals").after(shelf);
  })();
  function renderGuide() {
    $('founder-guide-cards').innerHTML = E.IDS.map(id => {
      const s = E.SPECIES[id], p = state.pets[id], next = [0,1,2].find(stop => !p.discoveries.includes(stop));
      const progress = '<div><dt>Trail discoveries</dt><dd>'+p.discoveries.length+' / 3</dd></div><div><dt>Practice badges</dt><dd>'+p.battles+' / '+(FULL ? 3 : 1)+'</dd></div>'+(ADVENTURES ? '<div><dt>Journey chapters</dt><dd>'+state.journeys[id]+' / 3</dd></div>' : '');
      const nickname = p.nickname && p.nickname !== s.name ? '<p class="guide-camp-name">In your camp: '+escape(p.nickname)+'</p>' : '';
      const keepsake = ADVENTURES ? E.RECIPES.find(recipe => recipe.founder === id) : null;
      const keepsakeNote = keepsake ? '<p class="guide-keepsake"><strong>Journey keepsake:</strong> '+escape(keepsake.name)+' · '+(state.crafted.includes(keepsake.id) ? 'Built and yours to place.' : state.journeys[id] === 3 ? 'Ready to build in the workshop.' : 'Finish this founder’s journey to unlock it.')+'</p>' : '';
      return '<article class="founder-guide-card" data-guide-entry="'+id+'" aria-labelledby="guide-name-'+id+'"><img src="'+art(id,true)+'" alt="" width="80" height="80" loading="lazy" decoding="async"><header><p class="guide-region">'+escape(s.region)+'</p><h3 id="guide-name-'+id+'">'+escape(s.name)+'</h3><p class="guide-title">'+escape(s.title)+'</p>'+nickname+'</header><div class="guide-copy"><p>'+escape(s.personality)+'</p><p><strong>Favorite routine:</strong> '+escape(s.preference)+'</p><dl class="guide-progress">'+progress+'</dl>'+keepsakeNote+'<details><summary>Practice tip for '+escape(s.name)+'</summary><p><strong>'+escape(s.signature)+'</strong> · Choose '+escape(signatureNames[id])+': '+escape(s.signatureHint)+'</p><button type="button" data-guide-action="practice" data-guide-founder="'+id+'">Practice with '+escape(s.name)+'</button></details></div><footer><button type="button" data-guide-action="trail" data-guide-founder="'+id+'">'+(next === undefined ? 'Revisit trail with ' : 'Explore with ')+escape(s.name)+'</button>'+(ADVENTURES ? '<button type="button" data-guide-action="story" data-guide-founder="'+id+'">'+escape(s.name)+'’s journey</button>' : '')+'</footer></article>';
    }).join('');
  }
  function followGuide(id, action) {
    if (schoolPaused || !E.IDS.includes(id)) return;
    if (action === 'story') { if(ADVENTURES) followJourney(id); return; }
    if (action === 'practice' && battle && !battle.result) {
      setView('practice'); say('Finish this spar first. Your next friend can go after.');
      (document.querySelector('[data-move="guard"]:not(:disabled)') || document.querySelector('.party-button:not(:disabled)')).focus();
      return;
    }
    if (action !== 'trail' && action !== 'practice') return;
    selectPet(id);
    if (action === 'practice') { setView('practice'); $('start-practice').focus(); return; }
    const stop = [0,1,2].find(index => !state.pets[id].discoveries.includes(index));
    if(stop !== undefined) act({type:'stop',value:stop});
    setView('trail');
    const tired = goalNeedsRest({kind:'trail',pet:id});
    if(tired) say(name(id)+' needs a rest before exploring. Rest is free.');
    (tired ? document.querySelector('#trail-actions [data-care="rest"]') : $('discover')).focus();
  }
  function buildGuide() {
    const tab = document.createElement('button'); tab.type='button'; tab.dataset.journalPage='guide'; tab.setAttribute('aria-pressed','false'); tab.innerHTML=item('book')+'Field guide';
    document.querySelector('.journal-page-buttons').append(tab);
    const guide = document.createElement('section'); guide.id='founder-guide'; guide.hidden=true; guide.setAttribute('aria-label','Guide to the four playable founders');
    guide.innerHTML='<p class="guide-intro">Four founders. Four ways of seeing the world. These notes show the friends and progress in this camp. '+(ADVENTURES ? 'Explore, share a story, or try a friendly spar' : 'Explore or try a friendly spar')+' at your own pace.</p><div id="founder-guide-cards" class="founder-guide-cards"></div>';
    $('camp-goals').after(guide);
  }
  buildAdventures();
  buildGuide();
  $("next-stump").onclick = () => {
    practiceTier = Math.min(3, battle.tier + 1);
    state = E.dispatch(state, { type: "select", id: practiceFounder }).state;
    startPractice();
  };
  $("forage").onclick = () => {
    if ($("forage").getAttribute("aria-disabled") === "true") { say("Already foraged at " + E.STOPS[state.stop].name.toLowerCase() + " today. Try another stop, or come back tomorrow."); return; }
    act({ type: "forage", day: today() });
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
  setSchoolAccess(schoolSession?.access);
  if (storageOK) persist();
  else $("save-status").textContent = "Save to file";
  say(welcome);
})();

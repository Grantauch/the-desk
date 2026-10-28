// UI logic tests in a DOM emulator: these do not certify rendered browser layout.
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const E = require("./engine.js"),
  ROOT = __dirname,
  KEY = "checklings.first-trail.v1";
function camp(t, { seed, quiet = false, denied = false } = {}) {
  const errors = [],
    downloads = [],
    blobs = [],
    console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM(
    fs.readFileSync(path.join(ROOT, "index.html"), "utf8"),
    {
      url: "https://sample.invalid/",
      runScripts: "outside-only",
      virtualConsole: console,
    },
  );
  const w = dom.window;
  w.structuredClone = structuredClone;
  w.matchMedia = () => ({
    matches: quiet,
    addEventListener() {},
    removeEventListener() {},
  });
  w.Blob = Blob;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  w.URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return "blob:sample/" + (blobs.length - 1);
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ href: this.href, name: this.download });
  };
  w.fetch = () => {
    throw Error("Unexpected network call");
  };
  if (denied)
    Object.defineProperty(w, "localStorage", {
      get() {
        throw Error("storage blocked");
      },
    });
  else if (seed)
    w.localStorage.setItem(
      KEY,
      typeof seed === "string" ? seed : JSON.stringify(seed),
    );
  w.eval(fs.readFileSync(path.join(ROOT, "engine.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(ROOT, "game.js"), "utf8"));
  t.after(() => {
    assert.deepEqual(errors, []);
    w.close();
  });
  return {
    w,
    doc: w.document,
    $: (id) => w.document.getElementById(id),
    click: (selector) => {
      const el = w.document.querySelector(selector);
      assert.ok(el, "Missing " + selector);
      assert.equal(el.disabled, false, "Disabled " + selector);
      el.click();
    },
    saved: () => JSON.parse(w.localStorage.getItem(KEY)),
    downloads,
    blobs,
    errors,
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function load(c, value, name = "camp.json") {
  const file = {
    name,
    size: Buffer.byteLength(value),
    text: async () => value,
  };
  Object.defineProperty(c.$("import-file"), "files", {
    value: [file],
    configurable: true,
  });
  c.$("import-file").dispatchEvent(new c.w.Event("change"));
  await flush();
}
test("New screen opens directly into camp with four unchanged founder references", (t) => {
  const c = camp(t);
  assert.equal(c.doc.querySelectorAll(".actor").length, 4);
  assert.equal(c.doc.querySelectorAll(".party-button").length, 4);
  assert.equal(c.$("world-view").hidden, false);
  assert.equal(c.$("journal-view").hidden, true);
  assert.equal(c.doc.querySelector(".intro"), null);
  assert.equal(c.doc.querySelector(".dummy"), null);
  for (const id of E.IDS)
    assert.ok(
      c.doc
        .querySelector(".actor[data-pet=" + id + "] img")
        .src.endsWith("/assets/" + id + ".gif"),
    );
});
test("Selected founder click keeps useful dialogue", (t) => {
  const c = camp(t);
  c.click(".party-button[data-pet=mochi]");
  assert.ok(c.$("message").textContent.trim().length > 0);
});
test("Care actions change the selected founder and expose actual item sprite props", (t) => {
  const c = camp(t);
  c.click("#care-actions [data-care=feed]");
  assert.equal(c.saved().pets.mochi.food, 98);
  assert.match(c.$("care-prop").className, /i-food/);
  assert.equal(c.$("care-prop").hidden, false);
  c.click("#care-actions [data-care=play]");
  assert.match(c.$("care-prop").className, /i-ball/);
  c.click("#care-actions [data-care=rest]");
  assert.equal(c.saved().pets.mochi.energy, 100);
  assert.ok(c.saved().pets.mochi.memories.some((m) => m.id === "care-routine"));
});
test("Trail controls reach all stops, record discoveries and unlock raster decor", (t) => {
  const c = camp(t);
  c.click("[data-view=trail]");
  for (let i = 0; i < 3; i++) {
    c.click('button[data-stop="' + i + '"]');
    c.click("#discover");
    assert.equal(c.$("trail-landmark").dataset.stop, String(i));
  }
  assert.equal(c.saved().pets.mochi.discoveries.length, 3);
  c.click("#open-decor");
  assert.equal(c.$("decor-dialog").open, true);
  c.click("[data-decor=planter]");
  assert.equal(c.saved().equipped, "planter");
  c.click("[data-view=home]");
  assert.equal(c.$("camp-decoration").hidden, false);
  assert.match(c.$("camp-decoration").className, /i-planter/);
});
test("Every founder has a different trail action and its own findings", (t) => {
  const c = camp(t);
  c.click("[data-view=trail]");
  const labels = new Set();
  for (const id of E.IDS) {
    c.click(".party-button[data-pet=" + id + "]");
    labels.add(c.$("discover-label").textContent);
    c.click("#discover");
    assert.equal(c.saved().pets[id].discoveries.length, 1);
  }
  assert.equal(labels.size, 4);
  assert.equal(c.$("actors").querySelectorAll(".actor").length, 1);
});
test("Stump responds with all four real atlas poses through visible move handlers", (t) => {
  const c = camp(t);
  c.click("[data-view=practice]");
  c.click("#start-practice");
  const poses = new Set([c.$("stump-sprite").dataset.pose]);
  for (const move of ["guard", "signature", "guard", "recover"]) {
    c.click("[data-move=" + move + "]");
    poses.add(c.$("stump-sprite").dataset.pose);
  }
  assert.deepEqual([...poses].sort(), ["0", "1", "2", "3"]);
  assert.match(c.$("enemy-hp-text").textContent, /116\/125/);
});
test("Practice can be completed from each founder through the new command UI", (t) => {
  const c = camp(t, { quiet: true });
  for (const id of E.IDS) {
    c.click("[data-view=home]");
    c.click(".party-button[data-pet=" + id + "]");
    c.click("[data-view=practice]");
    if (!c.$("practice-result").hidden) c.click("#retry-practice");
    else if (c.$("practice-welcome").hidden) c.click("#leave-practice");
    if (c.$("world-view").hidden) c.click("[data-view=practice]");
    if (!c.$("practice-welcome").hidden) c.click("#start-practice");
    for (let n = 0; n < 150 && c.$("practice-result").hidden; n++) {
      if (c.doc.querySelector("[data-move=guard]").disabled) {
        const next = c.doc.querySelector(
          ".party-button:not(:disabled)[aria-pressed=false]",
        );
        assert.ok(next);
        next.click();
        continue;
      }
      const intent = c.$("enemy-intent").textContent;
      const move =
        intent.startsWith("STRIKE") || intent.startsWith("BIG HIT")
          ? "guard"
          : c.doc.querySelector("[data-move=signature]").disabled
            ? "recover"
            : "signature";
      c.click("[data-move=" + move + "]");
    }
    assert.equal(c.$("practice-result").hidden, false);
    assert.equal(c.$("result-title").textContent, "PRACTICE CLEAR!");
    assert.equal(c.saved().pets[id].battles, 1);
    c.click("#leave-practice");
  }
});
test("Practice party switches take a turn and safe retreat leaves care unchanged", (t) => {
  const c = camp(t);
  const before = c.saved();
  c.click("[data-view=practice]");
  c.click("#start-practice");
  c.click(".party-button[data-pet=bolt]");
  assert.equal(c.$("battle-friend-name").textContent, "Bolt");
  assert.equal(c.$("friend-hp-text").textContent, "53/65");
  c.click("#leave-practice");
  assert.deepEqual(c.saved().pets, before.pets);
  assert.equal(c.$("care-actions").hidden, false);
});
test("Nicknames and journal strings remain inert text", (t) => {
  const s = E.initial();
  s.pets.mochi.memories = [
    { id: "markup", text: "<img src=x onerror=alert(1)>" },
  ];
  const c = camp(t, { seed: s });
  c.click("#rename");
  c.$("nickname").value = "<script>oops</script>";
  c.$("name-form").dispatchEvent(new c.w.Event("submit", { cancelable: true }));
  assert.equal(c.$("pet-name").textContent, "<script>oops</script>");
  c.click("[data-view=journal]");
  assert.ok(
    c.$("journal-entries").textContent.includes("<img src=x onerror=alert(1)>"),
  );
  assert.equal(c.$("journal-entries").querySelector("img"), null);
});
test("Saved v1 sample is preserved by the new UI", (t) => {
  let s = E.initial();
  for (let i = 0; i < 3; i++) {
    s = E.dispatch(s, { type: "stop", value: i }).state;
    s = E.dispatch(s, { type: "discover" }).state;
  }
  s = E.dispatch(s, { type: "unlock", id: "planter" }).state;
  const c = camp(t, { seed: s });
  assert.deepEqual(c.saved(), s);
  assert.equal(c.$("camp-decoration").hidden, false);
});
test("Quiet mode and system reduced motion use founder stills", (t) => {
  const c = camp(t, { quiet: true });
  assert.ok(
    [...c.doc.querySelectorAll(".actor img")].every((i) =>
      i.src.endsWith(".png"),
    ),
  );
  assert.match(c.$("quiet-label").textContent, /System/);
  c.click("#open-menu");
  c.click("#quiet-toggle");
  assert.equal(c.saved().quiet, true);
  assert.ok(c.doc.body.classList.contains("quiet"));
});
test("Portable save requests a JSON file containing current progress", async (t) => {
  const c = camp(t);
  c.click("#care-actions [data-care=play]");
  c.click("#open-menu");
  c.click("#export-save");
  assert.equal(c.downloads.length, 1);
  assert.match(c.downloads[0].name, /Checklings-Camp-.*\.json/);
  assert.deepEqual(JSON.parse(await c.blobs[0].text()), c.saved());
});
test("Import preview, confirmation and reversible safety copy preserve both camps", async (t) => {
  const c = camp(t);
  const previous = c.saved(),
    incoming = E.initial();
  incoming.pets.bolt.nickname = "New Bolt";
  incoming.selected = "bolt";
  await load(c, JSON.stringify(incoming));
  assert.deepEqual(c.saved(), previous);
  assert.equal(c.$("import-preview").hidden, false);
  c.click("#confirm-import");
  assert.equal(c.saved().pets.bolt.nickname, "New Bolt");
  c.click("#undo-import");
  assert.deepEqual(c.saved(), previous);
});
test("Malformed, future and oversized save files do not replace the current camp", async (t) => {
  const c = camp(t),
    before = c.saved();
  for (const text of [
    "{bad",
    JSON.stringify({ format: "checklings-first-trail", version: 2 }),
    " ".repeat(100001),
  ]) {
    await load(c, text);
    assert.equal(c.$("import-preview").hidden, true);
    assert.deepEqual(c.saved(), before);
  }
});
test("Denied or corrupted storage is labelled and existing corrupt data stays untouched", (t) => {
  const c = camp(t, { seed: "{bad" });
  assert.equal(c.$("save-status").textContent, "Save to file");
  c.click("#care-actions [data-care=play]");
  assert.equal(c.w.localStorage.getItem(KEY), "{bad");
  const d = camp(t, { denied: true });
  assert.equal(d.$("save-status").textContent, "Save to file");
  d.click("#care-actions [data-care=play]");
  assert.match(d.$("message").textContent, /ball/);
});
test("Other-tab save event refreshes the party and closes any stale practice", (t) => {
  const c = camp(t);
  c.click("[data-view=practice]");
  c.click("#start-practice");
  const s = E.initial();
  s.pets.mochi.nickname = "From other tab";
  c.w.dispatchEvent(
    new c.w.StorageEvent("storage", { key: KEY, newValue: JSON.stringify(s) }),
  );
  assert.equal(c.$("combat-scene").hidden, true);
  assert.equal(c.$("practice-welcome").hidden, false);
  assert.ok(c.$("party-list").textContent.includes("From other tab"));
});

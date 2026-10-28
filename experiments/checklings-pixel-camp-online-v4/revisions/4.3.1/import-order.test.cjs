const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.resolve(process.env.PIXEL_TEST_TARGET || __dirname),
  E = require(path.join(root, "engine.js")),
  KEY = "checklings.first-trail.v1";
const flush = () => new Promise((resolve) => setImmediate(resolve));
function setup(t) {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(e.message));
  const d = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
      url: "https://sample.invalid/",
      runScripts: "outside-only",
      virtualConsole: vc,
    }),
    w = d.window;
  w.structuredClone = structuredClone;
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.eval(fs.readFileSync(path.join(root, "engine.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "camp-goals.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "game.js"), "utf8"));
  t.after(() => {
    assert.deepEqual(errors, []);
    w.close();
  });
  return w;
}
function choose(w, file) {
  const input = w.document.getElementById("import-file");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new w.Event("change"));
}
test("An earlier slow save read cannot replace the latest selected save", async (t) => {
  const w = setup(t),
    a = E.initial(),
    b = E.initial();
  a.pets.mochi.nickname = "Old delayed file";
  b.selected = "bolt";
  b.pets.bolt.nickname = "Newest choice";
  let finish;
  choose(w, {
    size: 1000,
    text: () => new Promise((resolve) => (finish = resolve)),
  });
  choose(w, { size: 1000, text: async () => JSON.stringify(b) });
  await flush();
  finish(JSON.stringify(a));
  await flush();
  w.document.getElementById("confirm-import").click();
  assert.equal(
    JSON.parse(w.localStorage.getItem(KEY)).pets.bolt.nickname,
    "Newest choice",
  );
});
test("A rejected newest file invalidates an earlier pending save preview", async (t) => {
  const w = setup(t),
    before = w.localStorage.getItem(KEY);
  let finish;
  choose(w, {
    size: 1000,
    text: () => new Promise((resolve) => (finish = resolve)),
  });
  choose(w, { size: 100001, text: async () => "" });
  finish(JSON.stringify(E.initial()));
  await flush();
  assert.equal(w.document.getElementById("import-preview").hidden, true);
  w.document.getElementById("confirm-import").click();
  assert.equal(w.localStorage.getItem(KEY), before);
});

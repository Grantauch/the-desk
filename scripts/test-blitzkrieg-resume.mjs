import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const game = new URL("../public/hubs/blitzkrieg/", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, game), "utf8");

function fixture() {
  const html = read("index.html");
  assert.match(html, /id="pause"[^]*?<button[^>]*id="b-resume"[^>]*>Resume<\/button>/);

  function element(id = "") {
    return {
      id, innerHTML: "", children: [], parent: null,
      get firstChild() { return this.children[0] ?? null; },
      querySelector(selector) { return this.children.find((el) => "#" + el.id === selector) ?? null; },
      querySelectorAll: () => [],
      insertBefore(el, next) {
        const at = this.children.indexOf(next);
        this.children.splice(at < 0 ? this.children.length : at, 0, el);
        el.parent = this;
      },
      before(el) { this.parent.insertBefore(el, this); },
      after(el) { this.parent.insertBefore(el, this.parent.children[this.parent.children.indexOf(this) + 1] ?? null); },
      remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; },
    };
  }
  const menu = element(), pause = element(), maps = element();
  const staticPause = element("b-resume");
  pause.insertBefore(staticPause, null);
  const els = new Map([...html.matchAll(/\bid="([^"]+)"/g)].filter((m) => m[1] !== "b-resume").map((m) => [m[1], element(m[1])]));
  menu.insertBefore(els.get("b-play"), null);
  maps.insertBefore(els.get("map-grid"), null);
  const document = {
    createElement: () => element(),
    querySelector: (s) => s === "#title .menu" ? menu : null,
    querySelectorAll: () => [],
    getElementById: (id) => [...menu.children, ...pause.children, ...maps.children].find((el) => el.id === id) ?? els.get(id) ?? null,
  };
  const storage = new Map(), pauses = [], runs = [];
  const app = { togglePause: (value) => pauses.push(value), startRun: (map, endless, opt) => runs.push([map, endless, opt.snapshot]) };
  const BK = {
    app, MAPS: [{ id: "frontier", name: "Frontier" }],
    DIFFS: { regular: { name: "Regular", medals: 1, desc: "Regular" }, veteran: { name: "Veteran", medals: 2, desc: "Veteran" } },
    DIFF_ORDER: ["regular", "veteran"], WEATHER: { clear: { name: "Clear" } },
    dailyFor: () => ({ date: "2026-11-20", map: 0, mods: [], weather: "clear" }),
    Audio: { unlock() {} },
  };
  const ctx = vm.createContext({
    BK, document, setInterval() {},
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
  });
  vm.runInContext(read("js/ui.js"), ctx, { filename: "ui.js" });
  BK.Save.data = { settings: { diff: "regular" } };
  const ui = Object.create(BK.UI.prototype);
  Object.assign(ui, { app, toast() {}, syncSound() {} });
  BK.UI.prototype.screen = () => {};
  BK.UI.prototype.showMaps = () => {};
  ui.bind();
  vm.runInContext(read("js/ui3.js"), ctx, { filename: "ui3.js" });
  return { BK, ui, menu, maps, staticPause, pauses, runs, storage };
}

test("title refresh without a saved battle preserves Pause Resume", () => {
  const f = fixture();
  f.ui.screen("title");
  assert.ok(f.staticPause.parent, "Pause Resume must not be removed when there is no save");
  assert.equal(f.menu.children.length, 1);
  f.staticPause.onclick();
  assert.deepEqual(f.pauses, [false]);
  assert.deepEqual(f.runs, []);
});

test("Title, Maps, and Pause Resume stay distinct through save and clear", () => {
  const f = fixture();
  const snapshot = { v: 1, map: 0, mapId: "frontier", wave: 1, diff: "veteran", endless: false };
  f.storage.set("bk39-run-v1", JSON.stringify(snapshot));
  f.ui.screen("title");
  f.ui.screen("title");
  f.ui.showMaps();
  const title = f.menu.querySelector("#b-title-resume");
  const maps = f.maps.querySelector("#maps-resume");
  assert.ok(title && maps, "both launch menus expose the saved battle");
  assert.notEqual(title.id, f.staticPause.id);
  assert.equal(f.menu.children.filter((el) => el.id === title.id).length, 1);
  assert.match(title.innerHTML, /Frontier · wave 2 · Veteran/);
  assert.match(maps.innerHTML, /Resume Frontier at wave 2/);
  title.onclick(); maps.onclick(); f.staticPause.onclick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.runs)), [[0, false, snapshot], [0, false, snapshot]]);
  assert.deepEqual(f.pauses, [false]);
  f.BK.RunSave.clear();
  f.ui.screen("title");
  f.ui.showMaps();
  assert.ok(!title.parent && !maps.parent);
  assert.ok(f.staticPause.parent);
});

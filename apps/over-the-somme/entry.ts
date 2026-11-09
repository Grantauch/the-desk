import { mountSomme, type Quality, type SommeApi } from "./game/mount";
import { POIS } from "./game/world";
import type { Caption } from "./game/zerohour";

type Mode = "menu" | "fly" | "pause" | "log" | "cinema" | "end";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("field");
const root = document.body;
const zeroBtn = $<HTMLButtonElement>("take-zero");
const takeBtn = $<HTMLButtonElement>("take");
const errEl = $("err");
const nightBtn = $<HTMLButtonElement>("btn-night");
const wireBtn = $<HTMLButtonElement>("btn-wire");
const logBtn = $<HTMLButtonElement>("btn-log");
const pauseBtn = $<HTMLButtonElement>("btn-pause");
const soundBtn = $<HTMLButtonElement>("btn-sound");
const viewBtn = $<HTMLButtonElement>("btn-view");
const logList = $("log-list");
const logCount = $("log-count");
const logBar = $("log-bar");
const toast = $("toast");
const knob = $("knob");
const joy = $("joy");
const capTime = $("cap-time");
const capText = $("cap-text");
const capQuote = $("cap-quote");
const capQuoteText = $("cap-quote-text");
const capWho = $("cap-who");
const capCard = $("caption");
const clockEl = $("clock-time");
const clockBar = $("clock-bar");
const qualitySel = $<HTMLSelectElement>("quality");

const input = { joyX: 0, joyY: 0, rise: 0, lookDx: 0, lookDy: 0 };
const STORE = "somme-flyover-logged-v1";
const PREFS = "somme-flyover-prefs-v1";

let mode: Mode = "menu";
let resumeTo: Mode = "fly";
let wire = false;
let night = false;
let muted = false;
let view: "chase" | "cockpit" = "chase";
let api: SommeApi | null = null;
let toastTimer = 0;
let zeroLive = false;

const found = new Set<string>();
try {
  const raw = localStorage.getItem(STORE);
  if (raw) for (const id of JSON.parse(raw) as string[]) if (POIS.some((p) => p.id === id)) found.add(id);
  const prefs = JSON.parse(localStorage.getItem(PREFS) || "{}") as { muted?: boolean };
  muted = !!prefs.muted;
} catch {
  /* storage unavailable */
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify([...found]));
  } catch {
    /* storage unavailable */
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ muted }));
  } catch {
    /* storage unavailable */
  }
}

function setMode(next: Mode) {
  mode = next;
  root.dataset.mode = next;
  root.dataset.zero = zeroLive ? "on" : "off";
  pauseBtn.hidden = !(next === "fly" || next === "cinema");
}

function renderLog() {
  logCount.textContent = `${found.size} of ${POIS.length}`;
  logBar.style.width = `${(found.size / POIS.length) * 100}%`;
  logBtn.querySelector(".n")!.textContent = `${found.size}/${POIS.length}`;
  logList.replaceChildren(
    ...POIS.map((p, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = found.has(p.id) ? "site got" : "site";
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1).padStart(2, "0");
      const body = document.createElement("span");
      body.className = "body";
      const name = document.createElement("strong");
      name.textContent = p.name;
      const note = document.createElement("span");
      note.className = "note";
      note.textContent = found.has(p.id) ? p.blurb : "Not logged yet. Fly over it, or tap to go there.";
      body.append(name, note);
      b.append(num, body);
      b.addEventListener("click", () => {
        closeLog();
        api?.flyTo(p.x, p.z);
      });
      li.append(b);
      return li;
    }),
  );
}

function showToast(text: string) {
  toast.textContent = text;
  toast.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("on"), 2600);
}

function onPoi(id: string) {
  if (mode !== "fly" || found.has(id)) return;
  const poi = POIS.find((p) => p.id === id);
  if (!poi) return;
  found.add(id);
  save();
  renderLog();
  showToast(
    found.size === POIS.length
      ? `Logged ${poi.name}. Every site on the field is in your notebook.`
      : `Logged ${poi.name} · ${found.size} of ${POIS.length}`,
  );
}

function onCaption(c: Caption) {
  capCard.classList.remove("in");
  void capCard.offsetWidth;
  capTime.textContent = c.time;
  capText.textContent = c.text;
  if (c.quote) {
    capQuote.hidden = false;
    capQuoteText.textContent = c.quote;
    capWho.textContent = c.who ?? "";
  } else capQuote.hidden = true;
  capCard.classList.add("in");
}

function onClock(text: string, progress: number) {
  if (clockEl.textContent !== text) clockEl.textContent = text;
  clockBar.style.width = `${progress * 100}%`;
}

function onZeroEnd() {
  zeroLive = false;
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (mode === "cinema" || mode === "fly") {
    if (mode === "cinema") api?.setPhase("pause");
    setMode("end");
    $("again").focus();
  } else root.dataset.zero = "off";
}

function onQuality(q: Quality, auto: boolean) {
  qualitySel.value = auto ? "auto" : String(q);
  const opt = qualitySel.querySelector('option[value="auto"]');
  if (opt) opt.textContent = auto ? `Automatic (${["fast", "balanced", "best"][q]})` : "Automatic";
}

function syncNight(v: boolean) {
  night = v;
  nightBtn.setAttribute("aria-pressed", String(v));
}

function syncWire(v: boolean) {
  wire = v;
  wireBtn.setAttribute("aria-pressed", String(v));
}

function syncSound() {
  soundBtn.setAttribute("aria-pressed", String(!muted));
  soundBtn.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  soundBtn.querySelector(".on")!.toggleAttribute("hidden", muted);
  soundBtn.querySelector(".off")!.toggleAttribute("hidden", !muted);
}

function syncView() {
  viewBtn.setAttribute("aria-pressed", String(view === "cockpit"));
  viewBtn.querySelector(".t")!.textContent = view === "chase" ? "Cockpit" : "Chase";
}

const hooks = { current: { syncWire, syncNight, onPoi, onCaption, onClock, onZeroEnd, onQuality } };

function lock() {
  if (matchMedia("(pointer: fine)").matches) canvas.requestPointerLock?.();
}

function startSound() {
  api?.startAudio();
  api?.setMuted(muted);
}

function takeFlight() {
  if (!api) return;
  startSound();
  zeroLive = false;
  api.stopZeroHour();
  api.setPhase("fly");
  api.beginOverlook();
  setMode("fly");
  lock();
}

let titleTimer = 0;
function watchZero() {
  if (!api) return;
  startSound();
  zeroLive = true;
  if (document.pointerLockElement) document.exitPointerLock?.();
  const fade = $("fade");
  fade.classList.add("black");
  void fade.offsetWidth;
  api.startZeroHour();
  setMode("cinema");
  requestAnimationFrame(() => fade.classList.remove("black"));
  root.classList.add("titling");
  clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => root.classList.remove("titling"), 4200);
}

function takeControls() {
  root.classList.remove("titling");
  api?.takeControls();
  setMode("fly");
  lock();
}

function pause() {
  resumeTo = mode === "cinema" ? "cinema" : "fly";
  api?.setPhase("pause");
  if (document.pointerLockElement) document.exitPointerLock?.();
  input.joyX = input.joyY = input.rise = 0;
  setMode("pause");
}

function resume() {
  api?.setPhase(resumeTo === "cinema" ? "cinema" : "fly");
  setMode(resumeTo);
  if (resumeTo === "fly") lock();
}

function openLog() {
  if (mode !== "fly" && mode !== "pause") return;
  api?.setPhase("pause");
  if (document.pointerLockElement) document.exitPointerLock?.();
  input.joyX = input.joyY = input.rise = 0;
  setMode("log");
  renderLog();
  $("log-close").focus();
}

function closeLog() {
  api?.setPhase("fly");
  setMode("fly");
}

zeroBtn.addEventListener("click", watchZero);
takeBtn.addEventListener("click", takeFlight);
pauseBtn.addEventListener("click", (e) => {
  pause();
  (e.currentTarget as HTMLElement).blur();
});
$("resume").addEventListener("click", resume);
$("to-line").addEventListener("click", () => {
  zeroLive = false;
  api?.stopZeroHour();
  api?.beginOverlook();
  resumeTo = "fly";
  resume();
});
$("to-menu").addEventListener("click", () => {
  zeroLive = false;
  api?.stopZeroHour();
  api?.setPhase("menu");
  setMode("menu");
});
$("cap-take").addEventListener("click", takeControls);
$("replay-zero").addEventListener("click", watchZero);
$("cap-skip").addEventListener("click", () => {
  zeroLive = false;
  api?.stopZeroHour();
  onZeroEnd();
  setMode("end");
});
$("again").addEventListener("click", watchZero);
$("end-fly").addEventListener("click", () => {
  api?.takeControls();
  api?.setPhase("fly");
  setMode("fly");
  lock();
});
nightBtn.addEventListener("click", (e) => {
  syncNight(!night);
  api?.setNight(night);
  (e.currentTarget as HTMLElement).blur();
});
wireBtn.addEventListener("click", (e) => {
  syncWire(!wire);
  api?.setWireframe(wire);
  (e.currentTarget as HTMLElement).blur();
});
soundBtn.addEventListener("click", (e) => {
  muted = !muted;
  startSound();
  savePrefs();
  syncSound();
  (e.currentTarget as HTMLElement).blur();
});
viewBtn.addEventListener("click", (e) => {
  view = view === "chase" ? "cockpit" : "chase";
  api?.setView(view);
  syncView();
  (e.currentTarget as HTMLElement).blur();
});
logBtn.addEventListener("click", (e) => {
  (e.currentTarget as HTMLElement).blur();
  if (mode === "log") closeLog();
  else openLog();
});
$("log-close").addEventListener("click", closeLog);
$("log-reset").addEventListener("click", () => {
  found.clear();
  save();
  renderLog();
});
qualitySel.addEventListener("change", () => {
  const v = qualitySel.value;
  api?.setQuality(v === "auto" ? "auto" : (Number(v) as Quality));
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (e.code === "KeyL" && !e.repeat) {
    if (mode === "log") closeLog();
    else if (mode === "fly" || mode === "pause") openLog();
  } else if (e.code === "Escape") {
    if (mode === "log") closeLog();
    else if (mode === "pause") resume();
  } else if (e.code === "KeyP" && !e.repeat) {
    if (mode === "fly" || mode === "cinema") pause();
    else if (mode === "pause") resume();
  } else if (e.code === "KeyM" && !e.repeat) {
    soundBtn.click();
  } else if (e.code === "KeyV" && !e.repeat) {
    view = view === "chase" ? "cockpit" : "chase";
    syncView();
  } else if (e.code === "KeyT" && mode === "cinema") {
    takeControls();
  }
});

/* Touch stick and rise / drop buttons */
let joyId: number | null = null;
function joyTo(cx: number, cy: number) {
  const r = joy.getBoundingClientRect();
  let jx = (cx - (r.left + r.width / 2)) / (r.width * 0.38);
  let jy = -((cy - (r.top + r.height / 2)) / (r.height * 0.38));
  jx = Math.max(-1, Math.min(1, jx));
  jy = Math.max(-1, Math.min(1, jy));
  if (Math.hypot(jx, jy) < 0.14) jx = jy = 0;
  input.joyX = jx;
  input.joyY = jy;
  knob.style.transform = `translate(${jx * 28}px, ${-jy * 28}px)`;
}
function clearJoy() {
  joyId = null;
  input.joyX = input.joyY = 0;
  knob.style.transform = "translate(0px, 0px)";
}
joy.addEventListener("pointerdown", (e) => {
  joyId = e.pointerId;
  joy.setPointerCapture(e.pointerId);
  joyTo(e.clientX, e.clientY);
});
joy.addEventListener("pointermove", (e) => {
  if (joyId === e.pointerId) joyTo(e.clientX, e.clientY);
});
joy.addEventListener("pointerup", clearJoy);
joy.addEventListener("pointercancel", clearJoy);
for (const [id, v] of [
  ["rise", 1],
  ["drop", -1],
] as const) {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => {
    input.rise = v;
    b.setPointerCapture(e.pointerId);
  });
  const off = () => {
    input.rise = 0;
  };
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
}

renderLog();
syncSound();
syncView();
setMode("menu");

const coarse = matchMedia("(pointer: coarse)").matches;
try {
  api = mountSomme({
    canvas,
    map: $<HTMLCanvasElement>("map"),
    plot: $<HTMLCanvasElement>("plot"),
    hud: { alt: $("alt"), spd: $("spd"), hdg: $("hdg"), place: $("place"), blurb: $("blurb") },
    hooks,
    input,
    quality: coarse ? 1 : 2,
  });
  zeroBtn.disabled = false;
  takeBtn.disabled = false;
  zeroBtn.textContent = "Watch zero hour";
  takeBtn.textContent = "Fly freely";
} catch (err) {
  errEl.hidden = false;
  errEl.textContent =
    err instanceof Error && /WebGL/i.test(err.message)
      ? "This device could not start 3D graphics. Try a different browser or computer."
      : "The battlefield could not be drawn on this device.";
  zeroBtn.textContent = "Unavailable";
  takeBtn.hidden = true;
}

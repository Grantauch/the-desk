const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const runtime = fs.readFileSync(path.resolve(__dirname, "../public/storyhub/runtime/archive-media.js"), "utf8");

function fixture({ complete = false, width = 0, fallback = "/modern.svg", cachedFallback = false } = {}) {
  let currentSrc = "https://example.invalid/period.jpg", fallbackRequests = 0;
  const events = {};
  const image = {
    alt: "", complete, naturalWidth: width,
    dataset: { archiveAlt: "Actual archival photograph", archiveFallback: fallback, archiveFallbackAlt: "Editorial rail yard drawing" },
    style: { visibility: "hidden", removeProperty(key) { delete this[key]; } },
    addEventListener(type, callback) { events[type] = callback; },
    get src() { return currentSrc; },
    set src(value) {
      assert.equal(this.alt, "", "do not let old accessible copy survive a swap");
      assert.equal(this.style.visibility, "hidden", "hide stale pixels before a swap");
      currentSrc = value;
      fallbackRequests++;
      this.complete = cachedFallback;
      this.naturalWidth = cachedFallback ? 1 : 0;
    },
  };
  const label = { textContent: "ARCHIVE IMAGE NOT SHOWN · ", dataset: { archiveLoadedLabel: "PERIOD PHOTOGRAPH · " } };
  const source = { href: "https://example.invalid/record" };
  const media = {
    dataset: {},
    querySelector(sel) { return sel === "[data-archive-image]" ? image : sel === "[data-archive-label]" ? label : source; },
  };
  vm.runInNewContext(runtime, { document: { querySelectorAll: () => [media] } });
  const event = (type, px) => { image.complete = true; image.naturalWidth = px; events[type](); };
  return { image, label, media, source, event, requests: () => fallbackRequests };
}
test("cached archive confirms actual image and provenance", () => {
  const { image, label, media, source } = fixture({ complete: true, width: 18 });
  assert.equal(media.dataset.archiveState, "archival");
  assert.equal(image.alt, "Actual archival photograph");
  assert.equal(image.style.visibility, undefined);
  assert.match(label.textContent, /PERIOD PHOTOGRAPH/);
  assert.equal(source.href, "https://example.invalid/record");
});
test("pending lazy archive starts with no archival alt, pixels, or claim", () => {
  const { image, label, event } = fixture();
  assert.equal(image.alt, "");
  assert.equal(image.style.visibility, "hidden");
  assert.match(label.textContent, /NOT SHOWN/);
  event("load", 10);
  assert.equal(image.alt, "Actual archival photograph");
});
test("archive error swaps only after removing old label and alt; illustration has its own provenance", () => {
  const { image, label, media, event, requests, source } = fixture({ complete: true, width: 2 });
  event("error", 0);
  assert.equal(media.dataset.archiveState, "unavailable");
  assert.equal(image.alt, "");
  assert.equal(image.src, "/modern.svg");
  assert.match(label.textContent, /NOT SHOWN/);
  event("load", 7);
  assert.equal(media.dataset.archiveState, "illustration");
  assert.equal(image.alt, "Editorial rail yard drawing");
  assert.match(label.textContent, /NOT ARCHIVAL/);
  assert.equal(source.href, "https://example.invalid/record");
  assert.equal(requests(), 1);
});
test("fallback error is terminal, text only, with no retry loop or stale caption", () => {
  const { image, label, media, event, requests } = fixture();
  event("error", 0);
  event("error", 0);
  assert.equal(media.dataset.archiveState, "unavailable");
  assert.equal(image.alt, "");
  assert.equal(image.style.visibility, "hidden");
  assert.match(label.textContent, /NOT SHOWN/);
  assert.equal(requests(), 1);
});
test("cached fallback and no-fallback archive failures are safe", () => {
  const cached = fixture({ complete: true, cachedFallback: true });
  assert.equal(cached.media.dataset.archiveState, "illustration");
  assert.equal(cached.requests(), 1);
  const missing = fixture({ complete: true, fallback: "" });
  assert.equal(missing.media.dataset.archiveState, "unavailable");
  assert.equal(missing.requests(), 0);
  assert.equal(missing.image.alt, "");
});

/* Generated scenery is decorative. Failed or pending images retain the original canvas art. */
(function (BK) {
  'use strict';
  const base = new URL('./assets/generated-v1/', document.currentScript.src);
  const catalog = {};
  const loaded = new Map();
  const pending = new Map();
  for (const id of ['lot', 'boardwalk', 'cage', 'rooftop', 'underpass', 'harbor', 'pit', 'crown']) catalog['court-' + id] = id + '-backdrop-v1.webp';
  for (const id of ['asphalt', 'painted', 'wood']) catalog['surface-' + id] = id + '-surface-v1.webp';
  catalog.impact = 'impact-burst-v1.webp';
  catalog.trophy = 'crown-trophy-v1.webp';
  function load(key) {
    if (loaded.has(key)) return Promise.resolve(loaded.get(key));
    if (pending.has(key)) return pending.get(key);
    if (!catalog[key]) return Promise.resolve(null);
    const promise = new Promise((resolve) => {
      const img = new Image(); img.decoding = 'async';
      img.onload = () => {
        loaded.set(key, img); resolve(img);
        window.dispatchEvent(new CustomEvent('bk-art-ready', { detail: { key } }));
      };
      img.onerror = () => resolve(null);
      img.src = new URL(catalog[key], base).href;
    });
    pending.set(key, promise);
    return promise;
  }
  function surface(court) {
    return court.scene === 'gym' ? 'wood' : ['lot', 'cage', 'underpass'].includes(court.scene) ? 'asphalt' : 'painted';
  }
  BK.assets = {
    catalog, load, surface,
    url: (key) => catalog[key] ? new URL(catalog[key], base).href : '',
    get: (key) => loaded.get(key) || null,
    ensureCourt(court) { load('court-' + court.id); load('surface-' + surface(court)); },
  };
})(window.BK = window.BK || {});

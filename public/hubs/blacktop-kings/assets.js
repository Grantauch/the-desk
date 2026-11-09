/* Generated scenery is decorative. Failed or pending images retain the original canvas art. */
(function (BK) {
  'use strict';
  const base = new URL('./assets/generated-v1/', document.currentScript.src);
  const nextBase = new URL('./assets/generated-v2/', document.currentScript.src);
  const detailBase = new URL('./assets/generated-v3/', document.currentScript.src);
  const choiceBase = new URL('./assets/generated-v4/', document.currentScript.src);
  const catalog = {};
  const loaded = new Map();
  const pending = new Map();
  for (const id of ['lot', 'boardwalk', 'cage', 'rooftop', 'underpass', 'harbor', 'pit', 'crown']) catalog['court-' + id] = id + '-backdrop-v1.webp';
  for (const id of ['asphalt', 'painted', 'wood']) catalog['surface-' + id] = id + '-surface-v1.webp';
  catalog.impact = 'impact-burst-v1.webp';
  catalog.trophy = 'crown-trophy-v1.webp';
  const nextKeys = ['mode-career', 'mode-quick', 'mode-versus', 'mode-challenge', 'arch-slasher', 'arch-sniper', 'arch-general', 'arch-trickster', 'arch-big', 'ball'];
  for (const key of nextKeys) catalog[key] = key + '-v2.webp';
  const fans = ['fan-teal', 'fan-red', 'fan-gold', 'fan-violet', 'fan-cream', 'fan-blue'];
  const detailKeys = ['board-street', 'board-glass', ...fans, 'sideline-kit', 'jersey-weave', 'pad-vinyl'];
  for (const key of detailKeys) catalog[key] = key + '-v3.webp';
  const choiceKeys = ['mode-career', 'mode-quick', 'mode-versus', 'mode-challenge', 'arch-slasher', 'arch-sniper', 'arch-general', 'arch-trickster', 'arch-big', 'locker-room'];
  for (const key of choiceKeys) catalog[key] = key + '-v4.webp';
  const url = (key) => catalog[key] ? new URL(catalog[key], choiceKeys.includes(key) ? choiceBase : detailKeys.includes(key) ? detailBase : nextKeys.includes(key) ? nextBase : base).href : '';
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
      img.src = url(key);
    });
    pending.set(key, promise);
    return promise;
  }
  function surface(court) {
    return court.scene === 'gym' ? 'wood' : ['lot', 'cage', 'underpass'].includes(court.scene) ? 'asphalt' : 'painted';
  }
  const board = (court) => ['lot', 'cage', 'underpass', 'harbor'].includes(court.scene) ? 'board-street' : 'board-glass';
  BK.assets = {
    catalog, load, surface, board, fans,
    url,
    get: (key) => loaded.get(key) || null,
    ensureCourt(court) {
      load('court-' + court.id); load('surface-' + surface(court));
      load(board(court)); fans.forEach(load); load('sideline-kit'); load('jersey-weave'); load('pad-vinyl');
    },
  };
})(window.BK = window.BK || {});

import { HISTORY, newsFromPayload, pointFromLatLon } from './story-data.mjs';
import { atlasAir, atlasCloud, atlasSurface, atlasVertex } from './atlas-light.mjs';

import { createOrbitalPlayback, eligibleEvents } from './orbital-events.mjs';
import { createOrbitalEffects } from './orbital-effects.mjs';
import { countryAt, countryLabelAnchors, drawCountryLines } from './atlas-countries.mjs';

const RELATIONS_SOURCES = {
  ir: 'https://2021-2025.state.gov/u-s-relations-with-iran/',
  kn: 'https://travel.state.gov/en/international-travel/travel-advisories/north-korea.html',
  ks: 'https://2021-2025.state.gov/u-s-security-cooperation-with-korea/',
};

const root = document.querySelector('[data-atlas]');
if (root) initAtlas(root);

function initAtlas(atlas) {
  const $ = selector => atlas.querySelector(selector);
  const dialog = document.querySelector('[data-atlas-dialog]');
  const host = dialog.querySelector('[data-atlas-host]');
  const explore = $('[data-atlas-explore]');
  const canvas = $('[data-atlas-canvas]');
  const stage = $('.atlas-stage');
  const orbital = createOrbitalPlayback();
  const orbitalToggle = $('[data-orbital-toggle]');
  const orbitalCard = $('[data-orbital-card]');
  const orbitalSelect = $('[data-orbital-select]');
  const orbitalSource = $('[data-orbital-source]');
  let orbitalEnabled = true, displayedEvent;
  function updateOrbitalToggle() {
    const enabled = orbitalEnabled && !motionQuery.matches;
    orbitalToggle.textContent = enabled ? 'Pause orbital scenes' : 'Play orbital scenes';
    orbitalToggle.setAttribute('aria-pressed', String(Boolean(enabled)));
  }
  function updateOrbitalPicker() {
    orbitalSelect.replaceChildren(new Option('Choose a scene', ''),
      ...eligibleEvents(year).map(event => new Option(event.title, event.id)));
  }
  function showOrbitalCard(event) {
    if (event === displayedEvent) return;
    displayedEvent = event;
    if (!event) {
      if (orbitalCard.contains(document.activeElement)) orbitalToggle.focus({ preventScroll: true });
      orbitalCard.hidden = true;
      orbitalSelect.value = '';
      return;
    }
    $('[data-orbital-date]').textContent = `${event.date} · ${event.place}`;
    $('[data-orbital-title]').textContent = event.title;
    $('[data-orbital-summary]').textContent = event.summary;
    orbitalSource.hidden = !event.source;
    if (event.source) orbitalSource.href = event.source;
    orbitalCard.hidden = false;
    orbitalSelect.value = event.id;
  }
  function stopOrbital() {
    orbital.stop();
    showOrbitalCard(null);
    map?.render();
  }
  function replayOrbital(event) {
    if (!event || !map) return;
    closeCountry();
    closeStory();
    setMeasuring(false);
    map.center(event.lat, event.lon, false);
    orbital.replay(event, motionQuery.matches);
    map.render();
  }
  orbitalSelect.addEventListener('change', () => {
    if (!orbitalSelect.value) stopOrbital();
    else replayOrbital(eligibleEvents(year).find(event => event.id === orbitalSelect.value));
  });
  orbitalToggle.addEventListener('click', () => {
    orbitalEnabled = !orbitalEnabled;
    stopOrbital();
    updateOrbitalToggle();
  });
  $('[data-orbital-replay]').addEventListener('click', () => replayOrbital(displayedEvent));
  $('[data-orbital-close]').addEventListener('click', stopOrbital);
  const dial = $('[data-atlas-dial]');
  const coordinates = $('[data-atlas-coordinates]');
  const timeline = $('[data-atlas-year]');
  const airButton = $('[data-atlas-air]');
  const measureButton = $('[data-atlas-measure]');
  const measurePanel = $('[data-measure-panel]');
  const measureOutput = $('[data-measure-readout]');
  const clearMeasurement = $('[data-measure-clear]');
  const firstPinPrompt = 'Place pin A on the globe. Use Enter to pin the view center.';
  let atmosphereOn = true, measuring = false;
  function setMeasuring(enabled) {
    if (enabled) stopOrbital();
    measuring = enabled;
    measureButton.setAttribute('aria-pressed', String(enabled));
    atlas.classList.toggle('is-measuring', enabled);
    pins.inert = enabled;
    measurePanel.hidden = !enabled;
    measureOutput.textContent = firstPinPrompt;
    clearMeasurement.disabled = true;
    map?.clearMeasure();
    if (enabled) {
      closeCountry();
      closeStory();
      canvas.focus({ preventScroll: true });
    }
  }
  measureButton.addEventListener('click', () => setMeasuring(!measuring));
  clearMeasurement.addEventListener('click', () => {
    map?.clearMeasure();
    measureOutput.textContent = firstPinPrompt;
    canvas.focus({ preventScroll: true });
    clearMeasurement.disabled = true;
  });
  $('[data-measure-exit]').addEventListener('click', () => {
    measureButton.focus({ preventScroll: true });
    setMeasuring(false);
  });
  airButton.addEventListener('click', () => {
    atmosphereOn = !atmosphereOn;
    airButton.setAttribute('aria-pressed', String(atmosphereOn));
    atlas.classList.toggle('is-air-off', !atmosphereOn);
    weatherButton.disabled = !atmosphereOn || !rendererVisible;
    map?.setAtmosphere(atmosphereOn);
  });
  const weatherButton = $('[data-atlas-weather]');
  const weatherStatus = $('[data-atlas-weather-status]');
  const weatherCredit = $('[data-atlas-weather-credit]');
  const pins = $('[data-atlas-pins]');
  const countryLabels = $('[data-atlas-country-labels]');
  const choices = $('[data-atlas-choices]');
  const panel = $('[data-atlas-story]');
  const countryPanel = $('[data-atlas-country]');
  const countryPicker = $('[data-country-picker]');
  const borderPicker = $('[data-border-year]');
  const borderStatus = $('[data-atlas-borders-status]');
  const historicalYears = new Set([1878, 1914, 1938, 1945, 1960, 1994]);
  const borderRequests = new Map();
  let borderData = [];
  const countryFields = countryPanel.querySelectorAll('[data-country-fact]');
  let countryInvoker = null;
  const closeCountry = () => {
    if (countryPanel.contains(document.activeElement)) countryInvoker?.focus({ preventScroll: true });
    countryPanel.hidden = true;
    countryPicker.value = '';
  };
  $('[data-country-close]').addEventListener('click', closeCountry);
  function showCountry(country, invoker) {
    if (!country) { closeCountry(); return; }
    stopOrbital();
    closeStory();
    countryInvoker = invoker;
    const [name, , facts, code] = country;
    const historical = year !== Number(timeline.max);
    $('[data-country-title]').textContent = name;
    countryPanel.querySelectorAll('[data-country-modern]').forEach(element => { element.hidden = historical; });
    const historicalNote = $('[data-country-historical]');
    historicalNote.hidden = !historical;
    historicalNote.textContent = historical && facts && facts !== name ? `${year} · Subject to ${facts}` : `${year} · Historical map snapshot`;
    if (!historical) {
      countryFields.forEach((field, index) => {
        field.textContent = facts[index] || 'Unavailable in archive';
      });
    }
    const source = $('[data-country-source]');
    source.hidden = !historical && !code;
    source.href = historical ? 'https://github.com/aourednik/historical-basemaps' : 'https://github.com/factbook/factbook.json';
    source.textContent = historical ? 'Historical Basemaps ↗' : 'Factbook archive ↗';
    const relations = $('[data-country-relations]');
    relations.href = RELATIONS_SOURCES[code] ?? 'https://www.state.gov/countries-areas/';
    relations.textContent = RELATIONS_SOURCES[code] ? 'U.S. relations source ↗' : 'U.S. country profiles ↗';
    const nameSource = $('[data-country-name-source]');
    nameSource.hidden = !historical || name !== 'Republic of China' || year !== 1914;
    countryPicker.value = String(borderData.indexOf(country));
    countryPanel.hidden = false;
    $('[data-country-close]').focus({ preventScroll: true });
  }
  countryPicker.addEventListener('change', () => {
    const country = borderData[countryPicker.value];
    showCountry(country, countryPicker);
    const anchor = country && map?.countryAnchor(country);
    if (anchor) map.center(anchor.lat, anchor.lon);
  });
  borderPicker.addEventListener('change', () => {
    if (!borderPicker.value) return;
    timeline.value = borderPicker.value;
    timeline.dispatchEvent(new Event('input'));
  });
  async function updateBorderYear() {
    const requestedYear = year;
    const modern = requestedYear === Number(timeline.max);
    const hasSnapshot = modern || historicalYears.has(requestedYear);
    borderPicker.value = hasSnapshot ? String(requestedYear) : '';
    closeCountry();
    borderData = [];
    countryPicker.closest('label').hidden = true;
    map?.showBorders(null);
    borderStatus.textContent = hasSnapshot ? 'Loading borders…' : 'No border snapshot for this year. Choose a mapped year.';
    if (!hasSnapshot) return;
    if (!borderRequests.has(requestedYear)) {
      const url = modern ? '/atlas/countries.json' : `/atlas/history/${requestedYear}.json`;
      borderRequests.set(requestedYear, fetch(url).then(response => {
        if (!response.ok) throw new Error('Borders unavailable');
        return response.json();
      }));
    }
    try {
      const data = await borderRequests.get(requestedYear);
      if (year !== requestedYear) return;
      borderData = data;
      const options = data.map(([name], index) => new Option(name, String(index)));
      options.sort((a, b) => a.text.localeCompare(b.text));
      countryPicker.replaceChildren(new Option('Choose a country', ''), ...options);
      countryPicker.closest('label').hidden = false;
      borderStatus.textContent = modern ? 'Present-day borders · Natural Earth' : `${requestedYear} · Approximate borders · Historical Basemaps`;
      map?.showBorders(data);
    } catch {
      borderRequests.delete(requestedYear);
      if (year === requestedYear) borderStatus.textContent = 'Borders could not load. Select the map year again.';
    }
  }
  const status = $('[data-atlas-status]');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const compactQuery = matchMedia('(max-width: 699px)');
  const home = document.createComment('atlas home position');
  atlas.before(home);
  const placeholder = document.createElement('div');
  placeholder.hidden = true;
  home.after(placeholder);
  let originScroll = 0, restoreFocus = null, map = null;
  let year = Number(timeline.max), filter = 'history', selected = null;
  let news = [], newsState = 'idle', unplaced = 0, newsLoadedAt = 0;
  let paused = motionQuery.matches, busy = false, satellite = false, weatherLoading = false;
  const allHistory = HISTORY.map(story => ({ ...story, kind: 'history' }));
  let visibleStories = allHistory;
  let markerNodes = [];
  let rendererVisible = false;

  const setStatus = text => { status.textContent = text; };
  const closeStory = () => {
    const returnId = selected?.id;
    selected = null;
    panel.hidden = true;
    markerNodes.forEach(({ button }) => button.setAttribute('aria-expanded', 'false'));
    if (panel.contains(document.activeElement)) (markerNodes.find(node => node.story.id === returnId && !node.button.hidden)?.button ?? $('[data-atlas-index] summary')).focus();
    map?.render();
  };

  function selectStory(story, center = false) {
    stopOrbital();
    closeCountry();
    selected = story;
    panel.hidden = false;
    $('[data-story-cluster]').hidden = true;
    $('[data-story-kind]').textContent = story.kind === 'news' ? `${story.source} / current reporting` : story.course;
    $('[data-story-title]').textContent = story.title;
    $('[data-story-place]').textContent = story.place;
    $('[data-story-date]').textContent = story.date;
    $('[data-story-summary]').textContent = story.summary;
    const link = $('[data-story-link]');
    link.href = story.href;
    link.textContent = story.kind === 'news' ? 'read at source ↗' : 'open the story ↗';
    if (story.kind === 'news') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else { link.removeAttribute('target'); link.removeAttribute('rel'); }
    markerNodes.forEach(({ button, story: item }) => button.setAttribute('aria-expanded', String(item.id === story.id)));
    if (center) map?.center(story.lat, story.lon);
    map?.render();
  }

  function showCluster(stories) {
    stopOrbital();
    closeCountry();
    selected = null; panel.hidden = false;
    markerNodes.forEach(({button})=>button.setAttribute('aria-expanded','false'));
    $('[data-story-kind]').textContent = 'nearby on the atlas';
    $('[data-story-title]').textContent = `${stories.length} stories to explore`;
    for (const field of ['place','date','summary']) $(`[data-story-${field}]`).textContent = '';
    const options = $('[data-story-cluster]'); options.hidden = false; options.replaceChildren();
    stories.forEach(story => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = story.title;
      button.addEventListener('click', () => { selectStory(story, true); $('[data-story-link]').focus({preventScroll:true}); });
      options.append(button);
    });
    const link = $('[data-story-link]'); link.href='/storyhubs/'; link.textContent='browse all storyhubs →'; link.removeAttribute('target'); link.removeAttribute('rel');
  }

  function rebuildStories() {
    $('[data-atlas-news-link]').hidden = filter === 'history';
    visibleStories = [
      ...(filter !== 'news' ? allHistory.filter(story => story.year <= year) : []),
      ...(filter !== 'history' ? news : []),
    ];
    if ((!selected && !panel.hidden) || (selected && !visibleStories.some(story => story.id === selected.id && story.href === selected.href))) closeStory();
    pins.replaceChildren();
    choices.replaceChildren();
    markerNodes = visibleStories.map(story => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `atlas-pin atlas-pin--${story.kind}`;
      button.setAttribute('aria-label', `${story.kind}: ${story.title} — ${story.place}`);
      button.setAttribute('aria-expanded', String(selected?.id === story.id));
      button.dataset.storyId = story.id;
      if (story.kind === 'news') button.dataset.publisher = story.source;
      const glyph = document.createElement('span');
      glyph.className = 'atlas-pin__glyph';
      glyph.setAttribute('aria-hidden', 'true');
      const badge = document.createElement('span');
      badge.setAttribute('aria-hidden', 'true');
      button.append(glyph, badge);
      button.hidden = true;
      button.addEventListener('click', () => {
        const cluster = markerNodes.find(node => node.button === button)?.cluster ?? [story];
        if (cluster.length > 1) showCluster(cluster); else selectStory(story);
      });
      pins.append(button);
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'atlas-choice';
      const name = document.createElement('strong'); name.textContent = story.title;
      const where = document.createElement('span'); where.textContent = `${story.place} · ${story.date}`;
      choice.append(name, where);
      choice.addEventListener('click', () => {
        selectStory(story, true);
        panel.querySelector('a').focus({ preventScroll: true });
      });
      choices.append(choice);
      return { story, button, badge };
    });
    map?.render();
    if (filter === 'history') setStatus(`${visibleStories.length} historical stories through ${year}. Choose a marker or a story below.`);
    else if (newsState === 'loading') setStatus('Checking the newsrooms for recent, placeable stories…');
    else if (newsState === 'error') setStatus('News is unavailable right now. Try again, or open news today + then.');
    else if (newsState === 'empty') setStatus('No recent headlines with a single recognized location. Open news today + then for all reporting.');
    else setStatus(`${news.length} recent news ${news.length === 1 ? 'story' : 'stories'} located from headlines. ${unplaced ? `${unplaced} other headlines left unplaced. ` : ''}News dates are independent of the history slider.`);
  }

  async function loadNews() {
    if (newsState === 'loading') return;
    newsState = 'loading'; rebuildStories();
    try {
      const response = await fetch('/.netlify/functions/headlines', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('news unavailable');
      const result = newsFromPayload(await response.json());
      news = result.stories; unplaced = result.unplaced;
      newsLoadedAt = Date.now();
      newsState = news.length ? 'ready' : 'empty';
    } catch { newsState = 'error'; news = []; }
    rebuildStories();
  }

  weatherButton.addEventListener('click', async () => {
    if (!rendererVisible || weatherLoading) return;
    const enable = !satellite;
    weatherLoading = true;
    weatherButton.setAttribute('aria-busy', 'true');
    weatherStatus.textContent = enable ? 'Loading satellite clouds…' : '';
    try {
      let image = null;
      if (enable) {
        const response = await fetch('/.netlify/functions/atlas-clouds', { signal: AbortSignal.timeout(7000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('Cloud map unavailable');
        image = await response.blob();
      }
      await map.useSatellite(image);
      satellite = enable;
      weatherButton.setAttribute('aria-pressed', String(satellite));
      weatherCredit.hidden = !satellite || !rendererVisible;
      weatherStatus.textContent = satellite ? 'Satellite mosaic · Contains modified EUMETSAT data' : 'Illustrated clouds';
    } catch {
      weatherStatus.textContent = 'Satellite clouds unavailable. Showing illustrated clouds.';
    } finally {
      weatherLoading = false;
      weatherButton.removeAttribute('aria-busy');
      weatherButton.disabled = !rendererVisible || !atmosphereOn;
    }
  });

  function expand(invoker = document.activeElement) {
    if (dialog.open) return;
    stopOrbital();
    const framing = map?.framing();
    originScroll = scrollY;
    restoreFocus = invoker;
    // Preserve the desk's layout and scroll anchor while its globe is in the dialog.
    placeholder.style.height = `${atlas.offsetHeight}px`;
    placeholder.hidden = false;
    host.append(atlas);
    atlas.classList.add('is-expanded');
    dialog.showModal();
    updateBorderYear();
    document.documentElement.classList.add('atlas-open');
    map?.reframe(framing);
  }
  function restore() {
    stopOrbital();
    setMeasuring(false);
    closeCountry();
    const framing = map?.framing();
    home.after(atlas);
    placeholder.hidden = true;
    atlas.classList.remove('is-expanded');
    document.documentElement.classList.remove('atlas-open');
    scrollTo({ top: originScroll, behavior: 'instant' });
    (restoreFocus instanceof HTMLElement ? restoreFocus : explore).focus({ preventScroll: true });
    map?.reframe(framing);
  }
  explore.hidden = false;
  explore.addEventListener('click', () => expand(explore));
  dialog.addEventListener('close', restore);
  document.querySelector('[data-atlas-return]').addEventListener('click', () => dialog.close());
  document.querySelector('[data-atlas-courses]').addEventListener('click', () => {
    dialog.close();
    requestAnimationFrame(() => {
      const courses = document.querySelector('#courses');
      courses.scrollIntoView({ behavior: motionQuery.matches ? 'instant' : 'smooth' });
      courses.querySelector('a')?.focus({ preventScroll: true });
    });
  });
  $('[data-atlas-dismiss]').addEventListener('click', closeStory);
  timeline.addEventListener('input', () => {
    year = Number(timeline.value);
    stopOrbital();
    updateOrbitalPicker();
    const minimum = Number(timeline.min), maximum = Number(timeline.max);
    updateBorderYear();
    timeline.style.setProperty('--year-fill', `${100 * (year - minimum) / (maximum - minimum)}%`);
    $('[data-atlas-year-output]').textContent = year === maximum ? 'today' : String(year);
    rebuildStories();
  });
  atlas.querySelectorAll('[data-atlas-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.atlasFilter;
    atlas.querySelectorAll('[data-atlas-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    if (filter !== 'history' && (newsState !== 'loading' && (newsState !== 'ready' || Date.now()-newsLoadedAt > 300000))) loadNews();
    else rebuildStories();
  }));
  const motion = $('[data-atlas-motion]');
  function updateMotion() {
    motion.textContent = paused ? 'animate clouds' : 'pause clouds';
    motion.setAttribute('aria-pressed', String(paused));
    map?.render();
  }
  motion.addEventListener('click', () => { paused = !paused; updateMotion(); });
  motionQuery.addEventListener('change', () => {
    paused = motionQuery.matches;
    stopOrbital();
    updateOrbitalToggle();
    orbitalToggle.hidden = motionQuery.matches || !rendererVisible;
    updateMotion();
  });
  $('[data-atlas-instruments]').hidden = false;
  updateOrbitalPicker(); updateOrbitalToggle();
  updateMotion(); rebuildStories();

  async function start() {
    if (busy) return;
    busy = true;
    try {
      if (!window.THREE) await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/hubs/ush9-over-there/lib/three.min.js';
        script.onload = resolve; script.onerror = reject;
        document.head.append(script);
      });
      map = await createGlobe(window.THREE);
      rendererVisible = true;
      orbitalToggle.hidden = motionQuery.matches;
      $('[data-orbital-picker]').hidden = false;
      weatherButton.disabled = !atmosphereOn;
      airButton.disabled = measureButton.disabled = false;
      atlas.dataset.graphics = 'ready';
      $('[data-atlas-fallback]').hidden = true;
      map.resize();
    } catch {
      canvas.hidden = true;
      pins.hidden = true;
      atlas.dataset.graphics = 'fallback';
      $('[data-atlas-fallback]').hidden = false;
      atlas.querySelectorAll('[data-atlas-turn],[data-atlas-zoom],[data-atlas-reset],[data-atlas-motion]').forEach(button => { button.disabled = true; });
      setStatus('Map view is available. Choose a story below; all lessons and news filters still work.');
      $('[data-atlas-index]').open = true;
    }
  }

  async function createGlobe(T) {
    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 1.5));
    renderer.outputEncoding = T.sRGBEncoding;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 30);
    const tilt = new T.Group(), earth = new T.Group(); tilt.add(earth); scene.add(tilt);
    const loader = new T.TextureLoader();
    let surface, cloudMap, normalMap, depth;
    const columns = 144, rows = 96, reliefScale = .032;
    try {
      [surface, cloudMap, normalMap, depth] = await Promise.all([
        loader.loadAsync('/atlas/earth-color.jpg'), loader.loadAsync('/atlas/cloud-mask.jpg'),
        loader.loadAsync('/atlas/earth-normal.webp'),
        fetch('/atlas/earth-relief.bin').then(async response => {
          if (!response.ok) throw new Error('Terrain relief unavailable');
          return new Uint8Array(await response.arrayBuffer());
        }),
      ]);
      if (depth.length !== (columns + 1) * (rows + 1)) throw new Error('Invalid terrain mesh');
    } catch (error) { renderer.dispose(); renderer.forceContextLoss(); throw error; }
    surface.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    cloudMap.wrapS = T.RepeatWrapping;
    const sun = { value: new T.Vector3(-.85, .52, .33).normalize() };
    const cloudTexture = { value: cloudMap };
    const observedClouds = { value: 0 };
    const uniforms = {
      surface: { value: surface }, clouds: cloudTexture, relief: { value: normalMap },
      cloudOffset: { value: 0 }, sun,
      borders: { value: null }, showBorders: { value: 0 }, atmosphereOn: { value: 1 },
    };
    const geometry = new T.SphereGeometry(1, columns, rows);
    const positions = geometry.attributes.position;
    const vertex = new T.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).multiplyScalar(1 + reliefScale * depth[i] / 255);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    const terrain = new T.Mesh(geometry, new T.ShaderMaterial({
      uniforms, vertexShader: atlasVertex, fragmentShader: atlasSurface,
    }));
    earth.add(terrain);
    const raycaster = new T.Raycaster();
    function pickCountry(event) {
      if ((!borderData.length && !measuring) || transition) return;
      const bounds = canvas.getBoundingClientRect();
      const ndc = new T.Vector2(
        (event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(terrain)[0];
      if (!hit?.uv) return;
      if (measuring) addMeasurePoint(hit.uv.y * 180 - 90, hit.uv.x * 360 - 180);
      else showCountry(countryAt(borderData, hit.uv.x * 360 - 180, hit.uv.y * 180 - 90), canvas);
    }
    let labelAnchors = [];
    const labelSlots = Array.from({ length: 12 }, () => {
      const label = document.createElement('span');
      label.hidden = true;
      countryLabels.append(label);
      return label;
    });
    const countryAnchor = country => labelAnchors.find(anchor => anchor.country === country);
    function showBorders(data) {
      labelAnchors = data ? countryLabelAnchors(data) : [];
      if (!data) labelSlots.forEach(label => { label.hidden = true; });
      uniforms.borders.value?.dispose();
      uniforms.borders.value = data ? new T.CanvasTexture(drawCountryLines(data)) : null;
      uniforms.showBorders.value = Number(Boolean(data));
      render();
    }
    const measureGroup = new T.Group();
    earth.add(measureGroup);
    const measurePoints = [];
    const routeSegments = 72, routeSides = 6;
    const routeMaterial = new T.MeshBasicMaterial({ color: 0xffdda0 });
    const routeEdge = new T.MeshBasicMaterial({ color: 0x302522, side: T.BackSide });
    const pinMaterials = ['#ffce79', '#a9f2ff'].map((color, index) => {
      const icon = document.createElement('canvas');
      icon.width = icon.height = 96;
      const ctx = icon.getContext('2d');
      ctx.beginPath();
      ctx.arc(48, 48, 37, 0, Math.PI * 2);
      ctx.fillStyle = '#102330';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 47px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index === 0 ? 'A' : 'B', 48, 50);
      return new T.SpriteMaterial({ map: new T.CanvasTexture(icon), depthWrite: false });
    });
    let measureRoute = [], routeStarted = 0;
    function clearMeasure() {
      measurePoints.length = 0;
      measureGroup.clear();
      measureRoute.forEach(mesh => mesh.geometry.dispose());
      measureRoute = [];
      render();
    }
    function addMeasurePoint(lat, lon) {
      if (measurePoints.length === 2) clearMeasure();
      const point = new T.Vector3(...pointFromLatLon(lat, lon));
      const marker = new T.Sprite(pinMaterials[measurePoints.length]);
      marker.position.copy(point).multiplyScalar(1.05);
      marker.scale.setScalar(.13);
      marker.renderOrder = 3;
      measureGroup.add(marker);
      measurePoints.push(point);
      clearMeasurement.disabled = false;
      if (measurePoints.length === 1) {
        measureOutput.textContent = 'A placed · choose pin B';
      } else {
        const [a, b] = measurePoints;
        const angle = a.angleTo(b);
        if (angle > .000001) {
          const turn = new T.Quaternion().setFromUnitVectors(a, b);
          const partial = new T.Quaternion();
          const curve = new T.CatmullRomCurve3(Array.from({ length: routeSegments + 1 }, (_, index) => {
            const t = index / routeSegments;
            return a.clone().applyQuaternion(partial.identity().slerp(turn, t))
              .multiplyScalar(1.05 + .041 * Math.sin(Math.PI * t));
          }));
          measureRoute = [[.009, routeEdge], [.0045, routeMaterial]].map(([radius, material]) => {
            const mesh = new T.Mesh(new T.TubeGeometry(curve, routeSegments, radius, routeSides, false), material);
            // The edge is a back-face shell so the brighter tube is visible inside it.
            mesh.geometry.setDrawRange(0, motionQuery.matches ? Infinity : 0);
            measureGroup.add(mesh);
            return mesh;
          });
          routeStarted = performance.now();
        }
        const km = angle * 6371.0088;
        const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: km < 10 ? 1 : 0 });
        measureOutput.textContent = `A → B · ${format.format(km)} km / ${format.format(km / 1.609344)} mi`;
      }
      render();
    }
    const weather = new T.Mesh(new T.SphereGeometry(1.035, 112, 64), new T.ShaderMaterial({
      uniforms: { clouds: cloudTexture, observed: observedClouds, sun },
      vertexShader: atlasVertex, fragmentShader: atlasCloud, transparent: true, depthWrite: false,
    }));
    weather.renderOrder = 1;
    earth.add(weather);
    const airRadius = 1.14;
    const atmosphere = new T.Mesh(new T.SphereGeometry(airRadius, 80, 48), new T.ShaderMaterial({
      uniforms: { sun, radius: { value: airRadius } }, vertexShader: atlasVertex, fragmentShader: atlasAir,
      transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
    }));
    tilt.add(atmosphere);
    function setAtmosphere(visible) {
      weather.visible = atmosphere.visible = visible;
      uniforms.atmosphereOn.value = Number(visible);
      render();
    }
    const homeDistance = 3.62;
    let longitude = -30, latitude = 26, distance = homeDistance, zoomTarget = homeDistance, drag = null;
    const touches = new Map();
    let pinch = null, detailRequested = false;
    let pointerOnGlobe = false;
    let frame = 0, last = 0, cloudPhase = 0, floatPhase = 0, floatOffset = 0, isInView = true;
    let currentFraming = null, transition = null;
    let dialTransform = '', lastProjection = '', pinsDirty = true;
    const focalScale = 2 * Math.tan(camera.fov * Math.PI / 360);
    const vector = new T.Vector3(), normal = new T.Vector3(), view = new T.Vector3();

    async function useSatellite(image) {
      let texture = cloudMap;
      if (image) {
        const url = URL.createObjectURL(image);
        try { texture = await loader.loadAsync(url); }
        finally { URL.revokeObjectURL(url); }
        texture.wrapS = T.RepeatWrapping;
      }
      const previous = cloudTexture.value;
      cloudTexture.value = texture;
      observedClouds.value = Number(Boolean(image));
      if (previous !== cloudMap) previous.dispose();
      render();
    }

    function setZoom(next) {
      stopOrbital();
      zoomTarget = T.MathUtils.clamp(next, 1.62, 5.75);
      if (!detailRequested && zoomTarget < 2.85 && renderer.capabilities.isWebGL2
        && renderer.capabilities.maxTextureSize >= 5400) {
        detailRequested = true;
        loader.loadAsync('/atlas/earth-detail.webp').then(detail => {
          detail.anisotropy = surface.anisotropy;
          uniforms.surface.value = detail;
          surface.dispose();
          render();
        }).catch(() => {});
      }
      render();
    }

    function positionPins() {
      const w = stage.clientWidth, h = stage.clientHeight, occupied = [];
      scene.updateMatrixWorld();
      // Keep all stories available in the chooser, even when labels overlap.
      const ordered = [...markerNodes].sort((a,b) => Number(b.story.id === selected?.id) - Number(a.story.id === selected?.id));
      for (const node of ordered) {
        vector.set(...pointFromLatLon(node.story.lat, node.story.lon, 1.035));
        earth.localToWorld(vector);
        normal.copy(vector).sub(tilt.position).normalize();
        view.copy(camera.position).sub(vector).normalize();
        const facing = normal.dot(view) > .06;
        vector.project(camera);
        const x = (vector.x + 1) * w / 2, y = (1-vector.y) * h / 2;
        node.cluster = [node.story];
        const overlaps = occupied.find(p => Math.hypot(p.x-x,p.y-y) < 46);
        const inBounds = facing && x > 24 && x < w-24 && y > 24 && y < h-24;
        const shown = inBounds && !overlaps;
        node.button.hidden = !shown;
        if (shown) { node.button.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; occupied.push({x,y,node}); }
        else if (inBounds && overlaps) overlaps.node.cluster.push(node.story);
      }
      for (const {node} of occupied) {
        const count=node.cluster.length;
        node.button.classList.toggle('atlas-pin--mixed', node.cluster.some(story => story.kind !== node.story.kind));
        node.badge.textContent = count > 1 ? String(count) : '';
        node.badge.hidden = count === 1;
        node.button.setAttribute('aria-label',count>1?`${count} nearby stories. Choose a story.`:`${node.story.kind}: ${node.story.title} — ${node.story.place}`);
        node.button.dataset.clusterSize=String(count);
      }
      positionCountryLabels(w, h, occupied);
    }
    function positionCountryLabels(width, height, markers) {
      let used = 0;
      if (dialog.open && !measuring) {
        const boxes = markers.map(({x, y}) => ({ x, y, half: 30, height: 29 }));
        const limit = compactQuery.matches ? 6 : labelSlots.length;
        for (const { country, lat, lon, weight } of labelAnchors) {
          if (used >= limit) break;
          if (weight < (distance > 3.2 ? 42 : distance > 2.6 ? 12 : 3)) break;
          vector.fromArray(pointFromLatLon(lat, lon, 1.04));
          earth.localToWorld(vector);
          normal.copy(vector).sub(tilt.position).normalize();
          view.copy(camera.position).sub(vector).normalize();
          if (normal.dot(view) < .38) continue;
          vector.project(camera);
          const x = (vector.x + 1) * width / 2, y = (1 - vector.y) * height / 2;
          const [name] = country;
          const half = name.length * 4.2 + 7;
          if (x < half || x > width - half || y < 67 || y > height - 20
            || boxes.some(box => Math.abs(x - box.x) < half + box.half && Math.abs(y - box.y) < box.height)) continue;
          const label = labelSlots[used++];
          if (label.textContent !== name) label.textContent = name;
          label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
          label.hidden = false;
          boxes.push({ x, y, half, height: 22 });
        }
      }
      labelSlots.slice(used).forEach(label => { label.hidden = true; });
    }
    let effects, nightAmount = 0;
    const daylight = sun.value.clone();
    const nightLight = new T.Vector3(-.72, .13, -.68).normalize();
    const orbitalPoint = new T.Vector3(), orbitalNormal = new T.Vector3(), orbitalView = new T.Vector3();
    function eventInView(event) {
      orbitalPoint.fromArray(pointFromLatLon(event.lat, event.lon));
      earth.localToWorld(orbitalPoint);
      orbitalNormal.copy(orbitalPoint).sub(tilt.position).normalize();
      orbitalView.copy(camera.position).sub(orbitalPoint).normalize();
      if (orbitalNormal.dot(orbitalView) < .83) return false;
      orbitalPoint.project(camera);
      return Math.abs(orbitalPoint.x) < .82 && Math.abs(orbitalPoint.y) < .78;
    }
    function draw(t = performance.now()) {
      frame = 0;
      if (!rendererVisible || document.hidden || !isInView) return;
      const dt = Math.min(.05, last ? (t-last)/1000 : 0); last = t;
      if (!paused) cloudPhase += dt * .007;
      const stillCamera = paused || motionQuery.matches || measuring;
      if (!stillCamera) floatPhase += dt * 1.15;
      const interacting = pointerOnGlobe || stage.contains(document.activeElement) || drag || pinch || transition;
      const nextFloat = stillCamera || interacting ? 0 : Math.sin(floatPhase) * .026;
      floatOffset = stillCamera || Math.abs(nextFloat - floatOffset) < .0004
        ? nextFloat : T.MathUtils.lerp(floatOffset, nextFloat, 1 - Math.exp(-dt * 8));
      const zoomGap = zoomTarget - distance;
      distance = motionQuery.matches || Math.abs(zoomGap) < .003
        ? zoomTarget : distance + zoomGap * (1 - Math.exp(-dt * 16));
      earth.rotation.y = -(longitude + 90) * Math.PI / 180;
      tilt.rotation.x = latitude * Math.PI / 180;
      const box = stage.getBoundingClientRect();
      const expanded = atlas.classList.contains('is-expanded'), narrow = compactQuery.matches;
      let x = expanded || narrow ? 0 : .69;
      let y = (!expanded && narrow ? -.50 : 0) + floatOffset;
      // Preserve a usable globe on tall phone canvases instead of cropping
      // both continental coasts (and every marker) outside the narrow view.
      const portraitScale = Math.max(1, box.height / (box.width * .99));
      const targetZ = (distance - (expanded && !narrow ? .10 : 0)) * portraitScale;
      let scale = box.height / (focalScale * targetZ);
      let screenX = box.left + box.width / 2 + x * scale;
      let screenY = box.top + box.height / 2 - y * scale;
      if (transition && !motionQuery.matches) {
        const progress = Math.min(1, Math.max(0, (t - transition.started) / 510));
        const eased = 1 - (1 - progress) ** 3;
        screenX = T.MathUtils.lerp(transition.x, screenX, eased);
        screenY = T.MathUtils.lerp(transition.y, screenY, eased);
        scale = T.MathUtils.lerp(transition.scale, scale, eased);
        x = (screenX - box.left - box.width / 2) / scale;
        y = -(screenY - box.top - box.height / 2) / scale;
        if (progress === 1) transition = null;
      } else transition = null;
      tilt.position.set(x, y, 0);
      camera.position.z = box.height / (focalScale * scale);
      camera.updateMatrixWorld();
      currentFraming = { x: screenX, y: screenY, scale };
      const centeredLongitude = ((longitude + 180) % 360 + 360) % 360 - 180;
      const lat = Math.round(latitude), lon = Math.round(centeredLongitude);
      const label = `${Math.abs(lat).toString().padStart(2, '0')}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toString().padStart(3, '0')}° ${lon > 0 ? 'E' : 'W'}`;
      if (coordinates.textContent !== label) coordinates.textContent = label;
      const framing = `translate(${(screenX - box.left).toFixed(2)}px, ${(screenY - box.top).toFixed(2)}px) translate(-50%, -50%) scale(${(scale * 2.30 / 600).toFixed(4)})`;
      if (dialTransform !== framing) { dial.style.transform = framing; dialTransform = framing; }
      const observed = cloudTexture.value !== cloudMap;
      weather.rotation.y = observed ? 0 : cloudPhase;
      uniforms.cloudOffset.value = -weather.rotation.y / (2 * Math.PI);
      const projection = `${longitude}/${latitude}/${distance < 2.6 ? 2 : Number(distance < 3.2)}/${box.width}/${box.height}/${framing}`;
      if (pinsDirty || lastProjection !== projection) {
        positionPins();
        lastProjection = projection;
        pinsDirty = false;
      }
      const reduced = motionQuery.matches;
      const auto = orbitalEnabled && !expanded && !interacting && panel.hidden && countryPanel.hidden;
      const playback = orbital.tick({ dt, year, auto, blocked: measuring, still: reduced, visible: eventInView });
      const isNightScene = playback.scene?.id === 'thunderstorm' || playback.scene?.id === 'aurora';
      const nightTarget = isNightScene && atmosphereOn ? 1 : 0;
      nightAmount = reduced || Math.abs(nightTarget - nightAmount) < .002
        ? nightTarget
        : T.MathUtils.lerp(nightAmount, nightTarget, 1 - Math.exp(-dt * 2.8));
      sun.value.copy(daylight).lerp(nightLight, nightAmount).normalize();
      if (playback.scene) effects ??= createOrbitalEffects(T, earth, sun);
      effects?.update(playback.scene, playback.progress, atmosphereOn, reduced);
      if (playback.scene) showOrbitalCard(playback.scene);
      const routeProgress = !measureRoute.length || reduced ? 1 : Math.min(1, Math.max(0, (t - routeStarted) / 660));
      const drawnSegments = Math.ceil(routeSegments * (1 - (1 - routeProgress) ** 3));
      measureRoute.forEach(({geometry}) => geometry.setDrawRange(0, drawnSegments * routeSides * 6));
      renderer.render(scene, camera);
      if (playback.rotate) {
        showOrbitalCard(null);
        longitude = (longitude + dt * 7 + 540) % 360 - 180;
      }
      if (!frame && (!paused || transition || distance !== zoomTarget || routeProgress < 1
        || nightAmount !== nightTarget || (!reduced && (auto || playback.scene)))) {
        frame = requestAnimationFrame(draw);
      }
    }
    function render() {
      pinsDirty = true;
      if (!frame && rendererVisible && !document.hidden && isInView) frame = requestAnimationFrame(draw);
    }
    function resize() {
      const w=stage.clientWidth,h=stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); render();
    }
    function reframe(from) {
      if (!dialog.open) { drag = null; pinch = null; touches.clear(); }
      transition = from && !motionQuery.matches ? { ...from, started: performance.now() } : null;
      resize();
    }
    function center(lat, lon, interrupt = true) {
      if (interrupt) stopOrbital();
      latitude = lat; longitude = lon; render();
    }
    function zoom(direction) { setZoom(zoomTarget * Math.exp(direction * .19)); }
    function beginDrag(id, x, y, pendingTouch = false) {
      drag = { id, x, y, lat: latitude, lon: longitude, pendingTouch, canPick: dialog.open && !pinch };
    }
    function touchSpan() {
      const [first, second] = touches.values();
      return Math.max(12, Math.hypot(first.x - second.x, first.y - second.y));
    }
    stage.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') pointerOnGlobe = true; });
    stage.addEventListener('pointerleave', () => { pointerOnGlobe = false; render(); });
    canvas.addEventListener('pointerdown', event => {
      const touch = event.pointerType === 'touch';
      if (event.button !== 0 || (!event.isPrimary && (!touch || !dialog.open)) || (touch && touches.size >= 2)) return;
      stopOrbital();
      const wasExpanded = dialog.open;
      const pendingTouch = !wasExpanded && touch;
      if (!pendingTouch) expand(canvas);
      canvas.setPointerCapture(event.pointerId);
      if (touch) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        pinch = { span: touchSpan(), distance: zoomTarget };
        drag = null;
      } else {
        beginDrag(event.pointerId, event.clientX, event.clientY, pendingTouch);
        drag.canPick = wasExpanded;
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch) { setZoom(pinch.distance * pinch.span / touchSpan()); return; }
      }
      if (event.pointerId !== drag?.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) drag.canPick = false;
      if (drag.pendingTouch) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (Math.abs(dx) < 8) return;
        drag.pendingTouch = false;
        expand(canvas);
        canvas.setPointerCapture(event.pointerId);
      }
      longitude = drag.lon - dx * .24;
      latitude = Math.max(-78, Math.min(78, drag.lat + dy * .20));
      render();
    });
    const release = event => {
      if (touches.delete(event.pointerId) && pinch) {
        pinch = null;
        const [remaining] = touches.entries();
        if (remaining) {
          beginDrag(remaining[0], remaining[1].x, remaining[1].y);
          drag.canPick = false;
        }
      } else if (event.pointerId === drag?.id) drag = null;
    };
    canvas.addEventListener('pointerup', event => {
      const ended = event.pointerId === drag?.id ? drag : null;
      release(event);
      if (ended?.pendingTouch) expand(canvas);
      else if (ended?.canPick && Math.hypot(event.clientX - ended.x, event.clientY - ended.y) <= 6) pickCountry(event);
    });
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', event => {
      if (!dialog.open) return;
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
      setZoom(zoomTarget * Math.exp(T.MathUtils.clamp(event.deltaY * units, -240, 240) * .0023));
    }, { passive: false });
    canvas.addEventListener('keydown', event => {
      if (measuring && event.key === 'Enter') {
        event.preventDefault();
        const bounds = canvas.getBoundingClientRect();
        pickCountry({ clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
        return;
      }
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key)) return;
      event.preventDefault();
      stopOrbital();
      if (event.key==='ArrowLeft') longitude-=10;
      if (event.key==='ArrowRight') longitude+=10;
      if (event.key==='ArrowUp') latitude=Math.min(78,latitude+8);
      if (event.key==='ArrowDown') latitude=Math.max(-78,latitude-8);
      if (event.key==='+'||event.key==='=') zoom(-1);
      if (event.key==='-') zoom(1);
      render();
    });
    atlas.querySelectorAll('[data-atlas-turn]').forEach(button=>button.addEventListener('click',()=>{stopOrbital();longitude+=Number(button.dataset.atlasTurn)*15;render();}));
    atlas.querySelectorAll('[data-atlas-zoom]').forEach(button=>button.addEventListener('click',()=>zoom(Number(button.dataset.atlasZoom))));
    $('[data-atlas-reset]').addEventListener('click',()=>{stopOrbital();longitude=-30;latitude=26;distance=zoomTarget=homeDistance;render();});
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(entries=>{isInView=entries.some(entry=>entry.isIntersecting);last=0;if(!isInView&&frame){cancelAnimationFrame(frame);frame=0;}render();},{rootMargin:'50px'}).observe(stage);
    document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}render();});
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault(); rendererVisible=false; if(frame)cancelAnimationFrame(frame);frame=0;
      orbitalToggle.hidden = true;
      $('[data-orbital-picker]').hidden = true;
      stopOrbital();
      weatherButton.disabled=true;
      airButton.disabled = measureButton.disabled = true;
      setMeasuring(false); weatherCredit.hidden=true;
      canvas.hidden=true;pins.hidden=true;countryLabels.hidden=true;$('[data-atlas-fallback]').hidden=false;
      atlas.dataset.graphics='fallback';
      atlas.querySelectorAll('[data-atlas-turn],[data-atlas-zoom],[data-atlas-reset],[data-atlas-motion]').forEach(button=>{button.disabled=true;});
      setStatus('Map view is available. Choose a story below while graphics are unavailable.');
      $('[data-atlas-index]').open=true;
    });
    canvas.addEventListener('webglcontextrestored',()=>{
      rendererVisible=true;
      orbitalToggle.hidden = motionQuery.matches;
      $('[data-orbital-picker]').hidden = false;
      canvas.hidden=false;pins.hidden=false;countryLabels.hidden=false;$('[data-atlas-fallback]').hidden=true;
      weatherButton.disabled = !atmosphereOn; weatherCredit.hidden=!satellite;
      airButton.disabled = measureButton.disabled = false;
      atlas.dataset.graphics='ready';
      atlas.querySelectorAll('[data-atlas-turn],[data-atlas-zoom],[data-atlas-reset],[data-atlas-motion]').forEach(button=>{button.disabled=false;});
      rebuildStories();render();
    });
    // Diagnostics are intentionally only local, with no telemetry or student data.
    atlas.addEventListener('atlas:inspect',()=>{atlas.dataset.rendering=String(rendererVisible);});
    if (borderData.length) showBorders(borderData);
    return { clearMeasure, countryAnchor, setAtmosphere, showBorders, render, resize, center, reframe, useSatellite, framing: () => currentFraming };
  }

  // The page and source links are usable before the optional renderer arrives.
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}
    },{rootMargin:'150px'});observer.observe(stage);
  } else start();
}

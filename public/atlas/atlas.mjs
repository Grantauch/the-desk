import { HISTORY, newsFromPayload, pointFromLatLon } from './story-data.mjs';
import { atlasAir, atlasCloud, atlasSurface, atlasVertex } from './atlas-light.mjs';

const root = document.querySelector('[data-atlas]');
if (root) initAtlas(root);

function initAtlas(atlas) {
  const $ = selector => atlas.querySelector(selector);
  const dialog = document.querySelector('[data-atlas-dialog]');
  const host = dialog.querySelector('[data-atlas-host]');
  const explore = $('[data-atlas-explore]');
  const canvas = $('[data-atlas-canvas]');
  const stage = $('.atlas-stage');
  const dial = $('[data-atlas-dial]');
  const coordinates = $('[data-atlas-coordinates]');
  const timeline = $('[data-atlas-year]');
  const pins = $('[data-atlas-pins]');
  const choices = $('[data-atlas-choices]');
  const panel = $('[data-atlas-story]');
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
  let paused = motionQuery.matches, busy = false;
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
  };

  function selectStory(story, center = false) {
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

  function expand(invoker = document.activeElement) {
    if (dialog.open) return;
    const framing = map?.framing();
    originScroll = scrollY;
    restoreFocus = invoker;
    // Preserve the desk's layout and scroll anchor while its globe is in the dialog.
    placeholder.style.height = `${atlas.offsetHeight}px`;
    placeholder.hidden = false;
    host.append(atlas);
    atlas.classList.add('is-expanded');
    dialog.showModal();
    document.documentElement.classList.add('atlas-open');
    map?.reframe(framing);
  }
  function restore() {
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
    const minimum = Number(timeline.min), maximum = Number(timeline.max);
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
  motionQuery.addEventListener('change', () => { paused = motionQuery.matches; updateMotion(); });
  $('[data-atlas-instruments]').hidden = false;
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
    const columns = 144, rows = 96, reliefScale = .021;
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
    const sun = { value: new T.Vector3(-.86, .51, .42).normalize() };
    const uniforms = {
      surface: { value: surface }, clouds: { value: cloudMap }, relief: { value: normalMap },
      cloudOffset: { value: new T.Vector2() }, sun,
    };
    const geometry = new T.SphereGeometry(1, columns, rows);
    const positions = geometry.attributes.position;
    const vertex = new T.Vector3();
    for (let i = 0; i < positions.count; i++) {
      vertex.fromBufferAttribute(positions, i).multiplyScalar(1 + reliefScale * depth[i] / 255);
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    earth.add(new T.Mesh(geometry, new T.ShaderMaterial({
      uniforms, vertexShader: atlasVertex, fragmentShader: atlasSurface,
    })));
    const clouds = new T.SphereGeometry(1, 112, 64);
    function cloudShell(radius, upper) {
      const shell = new T.Mesh(clouds, new T.ShaderMaterial({
        uniforms: { clouds: { value: cloudMap }, sun, upper: { value: upper } },
        vertexShader: atlasVertex, fragmentShader: atlasCloud, transparent: true, depthWrite: false,
      }));
      shell.scale.setScalar(radius);
      shell.renderOrder = upper + 1;
      earth.add(shell);
      return shell;
    }
    const weather = cloudShell(1.022, 0);
    const cirrus = cloudShell(1.037, 1);
    const atmosphere = new T.Mesh(new T.SphereGeometry(1.056, 80, 48), new T.ShaderMaterial({
      uniforms: { sun }, vertexShader: atlasVertex, fragmentShader: atlasAir,
      transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
    }));
    tilt.add(atmosphere);
    const homeDistance = 3.62;
    let longitude = -30, latitude = 26, distance = homeDistance, drag = null;
    let frame = 0, last = 0, cloudPhase = 0, isInView = true;
    let currentFraming = null, transition = null;
    let dialTransform = '';
    const focalScale = 2 * Math.tan(camera.fov * Math.PI / 360);
    const vector = new T.Vector3(), normal = new T.Vector3(), view = new T.Vector3();

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
        node.badge.textContent = count > 1 ? String(count) : '';
        node.badge.hidden = count === 1;
        node.button.setAttribute('aria-label',count>1?`${count} nearby stories. Choose a story.`:`${node.story.kind}: ${node.story.title} — ${node.story.place}`);
        node.button.dataset.clusterSize=String(count);
      }
    }
    function draw(t = performance.now()) {
      frame = 0;
      if (!rendererVisible || document.hidden || !isInView) return;
      const dt = Math.min(.05, last ? (t-last)/1000 : 0); last = t;
      if (!paused) cloudPhase += dt * .0016;
      earth.rotation.y = -(longitude + 90) * Math.PI / 180;
      tilt.rotation.x = latitude * Math.PI / 180;
      const box = stage.getBoundingClientRect();
      const expanded = atlas.classList.contains('is-expanded'), narrow = compactQuery.matches;
      let x = expanded || narrow ? 0 : .69;
      let y = !expanded && narrow ? -.50 : 0;
      // Preserve a usable globe on tall phone canvases instead of cropping
      // both continental coasts (and every marker) outside the narrow view.
      const portraitScale = Math.max(1, box.height / (box.width * .99));
      const targetZ = (distance + (expanded ? .17 : 0)) * portraitScale;
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
      weather.rotation.y = cloudPhase;
      cirrus.rotation.y = .025 + cloudPhase * 1.55;
      uniforms.cloudOffset.value.set(-weather.rotation.y / (2 * Math.PI), -cirrus.rotation.y / (2 * Math.PI));
      positionPins(); renderer.render(scene, camera);
      if (!paused || transition) frame = requestAnimationFrame(draw);
    }
    function render() { if (!frame && rendererVisible && !document.hidden && isInView) frame = requestAnimationFrame(draw); }
    function resize() {
      const w=stage.clientWidth,h=stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); render();
    }
    function reframe(from) {
      transition = from && !motionQuery.matches ? { ...from, started: performance.now() } : null;
      resize();
    }
    function center(lat, lon) { latitude = lat; longitude = lon; render(); }
    function zoom(direction) { distance = Math.max(2.65,Math.min(5.3,distance+direction*.24)); render(); }
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      const pendingTouch = !dialog.open && event.pointerType === 'touch';
      if (!pendingTouch) expand(canvas);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lat: latitude, lon: longitude, pendingTouch };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== drag?.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
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
    const release = event => { if (event.pointerId === drag?.id) drag = null; };
    canvas.addEventListener('pointerup', event => {
      if (event.pointerId === drag?.id && drag.pendingTouch) expand(canvas);
      release(event);
    });
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    canvas.addEventListener('wheel', event => { if (!dialog.open) return; event.preventDefault(); zoom(Math.sign(event.deltaY)); },{passive:false});
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key)) return;
      event.preventDefault();
      if (event.key==='ArrowLeft') longitude-=10;
      if (event.key==='ArrowRight') longitude+=10;
      if (event.key==='ArrowUp') latitude=Math.min(78,latitude+8);
      if (event.key==='ArrowDown') latitude=Math.max(-78,latitude-8);
      if (event.key==='+'||event.key==='=') zoom(-1);
      if (event.key==='-') zoom(1);
      render();
    });
    atlas.querySelectorAll('[data-atlas-turn]').forEach(button=>button.addEventListener('click',()=>{longitude+=Number(button.dataset.atlasTurn)*15;render();}));
    atlas.querySelectorAll('[data-atlas-zoom]').forEach(button=>button.addEventListener('click',()=>zoom(Number(button.dataset.atlasZoom))));
    $('[data-atlas-reset]').addEventListener('click',()=>{longitude=-30;latitude=26;distance=homeDistance;render();});
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(entries=>{isInView=entries.some(entry=>entry.isIntersecting);last=0;if(!isInView&&frame){cancelAnimationFrame(frame);frame=0;}render();},{rootMargin:'50px'}).observe(stage);
    document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}render();});
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault(); rendererVisible=false; if(frame)cancelAnimationFrame(frame);frame=0;
      canvas.hidden=true;pins.hidden=true;$('[data-atlas-fallback]').hidden=false;
      atlas.dataset.graphics='fallback';
      atlas.querySelectorAll('[data-atlas-turn],[data-atlas-zoom],[data-atlas-reset],[data-atlas-motion]').forEach(button=>{button.disabled=true;});
      setStatus('Map view is available. Choose a story below while graphics are unavailable.');
      $('[data-atlas-index]').open=true;
    });
    canvas.addEventListener('webglcontextrestored',()=>{
      rendererVisible=true;canvas.hidden=false;pins.hidden=false;$('[data-atlas-fallback]').hidden=true;
      atlas.dataset.graphics='ready';
      atlas.querySelectorAll('[data-atlas-turn],[data-atlas-zoom],[data-atlas-reset],[data-atlas-motion]').forEach(button=>{button.disabled=false;});
      rebuildStories();render();
    });
    // Diagnostics are intentionally only local, with no telemetry or student data.
    atlas.addEventListener('atlas:inspect',()=>{atlas.dataset.rendering=String(rendererVisible);});
    return { render, resize, center, reframe, framing: () => currentFraming };
  }

  // The page and source links are usable before the optional renderer arrives.
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();start();}
    },{rootMargin:'150px'});observer.observe(stage);
  } else start();
}

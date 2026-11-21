export type Pick = (id: string) => void;

export const all = <T extends Element = HTMLElement>(node: ParentNode, selector: string) =>
  Array.from(node.querySelectorAll<T>(selector));
export const find = <T extends Element = HTMLElement>(node: ParentNode, selector: string) =>
  node.querySelector<T>(selector)!;

function pressed(buttons: HTMLElement[], match: (button: HTMLElement) => boolean) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(match(button)));
}

export function mountCast(node: HTMLElement, onPick: Pick) {
  const cards = all(node, '[data-person-card]');
  const picker = find<HTMLSelectElement>(node, '[data-cast-picker]');
  function select(id: string) {
    if (!cards.some((card) => card.dataset.personCard === id)) return false;
    for (const card of cards) card.hidden = card.dataset.personCard !== id;
    picker.value = id;
    return true;
  }
  picker.addEventListener('change', () => {
    select(picker.value);
    onPick(picker.value);
  });
  select(picker.value);
  return { select };
}

function setZoom(window: HTMLElement, zoom: number, min: number, max: number) {
  window.closest<HTMLElement>('[data-media-viewer], [data-map]')?.style.setProperty('--sh-zoom', String(zoom));
  const container = window.closest<HTMLElement>('[data-media-viewer], [data-map]');
  if (!container) return;
  const buttons = all<HTMLButtonElement>(container, '[data-map-zoom], [data-media-zoom]');
  for (const button of buttons) {
    const direction = Number(button.dataset.mapZoom ?? button.dataset.mediaZoom);
    button.disabled = direction < 0 ? zoom <= min : direction > 0 ? zoom >= max : zoom === min;
  }
}

export function mountMedia(node: HTMLElement, onPick?: Pick) {
  const picker = node.querySelector<HTMLSelectElement>('[data-media-picker]');
  const cards = all(node, '[data-media-card]');
  let active = cards[0];
  let zoom = 1;
  function select(id: string) {
    const next = cards.find((card) => card.dataset.mediaCard === id);
    if (!next) return false;
    active = next;
    for (const card of cards) card.hidden = card !== active;
    if (picker) picker.value = id;
    magnify(0);
    return true;
  }
  function magnify(direction: number) {
    const window = find(active, '[data-media-window]');
    zoom = direction === 0 ? 1 : Math.max(1, Math.min(4, zoom + direction * .5));
    setZoom(window, zoom, 1, 4);
    window.tabIndex = zoom > 1 ? 0 : -1;
    if (zoom === 1) window.scrollTo(0, 0);
  }
  picker?.addEventListener('change', () => {
    select(picker.value);
    onPick?.(picker.value);
  });
  for (const button of all(node, '[data-media-zoom]')) {
    button.addEventListener('click', () => magnify(Number(button.dataset.mediaZoom)));
  }
  select(active.dataset.mediaCard!);
  return { select };
}

export function mountAudio(node: HTMLElement) {
  const audio = find<HTMLAudioElement>(node, '[data-audio-player]');
  const fallback = find(node, '[data-audio-fallback]');
  const current = find(node, '[data-audio-current]');
  const transcript = all(node, '[data-audio-cue]');
  const buttons = all<HTMLButtonElement>(node, '[data-audio-seek]');
  let active: HTMLElement | undefined;
  function update() {
    const cue = transcript.findLast((row) => Number(row.dataset.audioCue) <= audio.currentTime);
    current.hidden = audio.paused;
    if (cue === active) return;
    active?.removeAttribute('aria-current');
    active = cue;
    active?.setAttribute('aria-current', 'true');
    current.textContent = active?.querySelector('p')?.textContent ?? '';
  }
  function fail() {
    fallback.hidden = false;
    current.hidden = true;
    all(node, '[data-audio-static]').forEach((time) => { time.hidden = false; });
    buttons.forEach((button) => { button.hidden = true; });
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      audio.currentTime = Number(button.dataset.audioSeek);
      audio.play().catch(() => { if (audio.error) fail(); });
    });
  }
  all(node, '[data-audio-static]').forEach((time) => { time.hidden = true; });
  for (const event of ['timeupdate', 'play', 'pause', 'seeked', 'ended']) audio.addEventListener(event, update);
  audio.addEventListener('error', fail);
  update();
}

export function mountContext(node: HTMLElement, onPick: (kind: 'notes' | 'media', id: string) => void) {
  const buttons = all(node, '[data-context-collection]');
  const sections = all(node, '[data-context-section]');
  const notes = all(node, '[data-note-card]');
  const sources = all<HTMLDetailsElement>(node, '[data-source-card]');
  const picker = find<HTMLSelectElement>(node, '[data-context-picker]');
  const media = mountMedia(find(node, '[data-media-viewer]'), (id) => onPick('media', id));
  function collection(name: string) {
    pressed(buttons, (button) => button.dataset.contextCollection === name);
    for (const section of sections) section.hidden = section.dataset.contextSection !== name;
  }
  function select(kind: 'notes' | 'sources' | 'media', id: string, reveal = true) {
    if (kind === 'notes') {
      if (!notes.some((note) => note.dataset.noteCard === id)) return;
      for (const note of notes) note.hidden = note.dataset.noteCard !== id;
      picker.value = id;
    }
    if (kind === 'sources') {
      const source = sources.find((item) => item.dataset.sourceCard === id);
      if (!source) return;
      source.open = true;
    }
    if (kind === 'media' && !media.select(id)) return;
    if (reveal) collection(kind);
  }
  for (const button of buttons) button.addEventListener('click', () => collection(button.dataset.contextCollection!));
  picker.addEventListener('change', () => {
    select('notes', picker.value);
    onPick('notes', picker.value);
  });
  select('notes', picker.value);
  return { select, collection };
}

function timeLabel(minute: number, scale: string) {
  const date = new Date(minute * 60_000);
  const options: Intl.DateTimeFormatOptions = scale === 'hours'
    ? { hour: 'numeric', minute: '2-digit' }
    : scale === 'years'
      ? { year: 'numeric' }
      : scale === 'months'
        ? { month: 'short', year: 'numeric' }
        : { month: 'short', day: 'numeric', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
}

export function mountTimeline(node: HTMLElement, onPick: Pick) {
  const cards = all(node, '[data-event-card]').map((element) => ({
    element, id: element.dataset.eventCard!, minute: Number(element.dataset.minute), scales: element.dataset.scales!.split(' '),
  }));
  const scaleButtons = all(node, '[data-scale]');
  const picker = find<HTMLSelectElement>(node, '[data-time-picker]');
  const scrub = find<HTMLInputElement>(node, '[data-time-scrub]');
  const output = find(node, '[data-time-output]');
  const status = find(node, '[data-time-status]');
  const play = find<HTMLButtonElement>(node, '[data-time-play]');
  const ticks = find(node, '[data-time-ticks]');
  const previous = find<HTMLButtonElement>(node, '[data-time-step="-1"]');
  const next = find<HTMLButtonElement>(node, '[data-time-step="1"]');
  const configuredRange = (node.dataset.range ?? '').split(',').filter(Boolean).map(Number);
  let scale = scaleButtons[0].dataset.scale!;
  let visible = cards.filter((card) => card.scales.includes(scale));
  let index = 0;
  let timer: number | undefined;

  function stop() {
    window.clearInterval(timer);
    timer = undefined;
    play.textContent = 'Play sequence';
  }
  function render(position = visible[index].minute, emit = false) {
    const picked = visible[index];
    const changed = picker.value !== picked.id;
    for (const card of cards) card.element.hidden = card !== picked;
    picker.value = picked.id;
    scrub.valueAsNumber = position;
    const timestamp = timeLabel(position, scale);
    output.textContent = timestamp;
    scrub.setAttribute('aria-valuetext', timestamp + '. ' + find(picked.element, '[data-record-heading]').textContent);
    previous.disabled = index === 0;
    next.disabled = index === visible.length - 1;
    if (emit && changed) status.textContent = find(picked.element, '[data-record-heading]').textContent;
  }
  function adoptScale(value: string, preferred?: string) {
    stop();
    scale = value;
    visible = cards.filter((card) => card.scales.includes(scale));
    index = Math.max(0, visible.findIndex((card) => card.id === preferred));
    const start = scale === 'hours' && configuredRange.length === 2 ? configuredRange[0] : visible[0].minute;
    const end = scale === 'hours' && configuredRange.length === 2 ? configuredRange[1] : visible.at(-1)!.minute;
    scrub.min = String(start);
    scrub.max = String(Math.max(start + 1, end));
    scrub.step = '1';
    scrub.disabled = start === end;
    find(node, '[data-time-min]').textContent = timeLabel(start, scale);
    find(node, '[data-time-max]').textContent = timeLabel(end, scale);
    play.hidden = scale !== 'hours' || visible.length < 2;
    pressed(scaleButtons, (button) => button.dataset.scale === scale);
    let last = -1;
    const marks = visible.flatMap(({ minute }) => {
      const ratio = (minute - start) / Math.max(1, end - start);
      if (ratio - last < 0.035) return [];
      last = ratio;
      const tick = document.createElement('span');
      tick.style.left = ratio * 100 + '%';
      return [tick];
    });
    ticks.replaceChildren(...marks);
    for (const option of picker.options) {
      const present = visible.some((card) => card.id === option.value);
      option.hidden = !present;
      option.disabled = !present;
    }
    render();
  }
  function select(id: string) {
    const event = cards.find((card) => card.id === id);
    if (!event) return false;
    if (event.scales.includes(scale)) {
      index = visible.indexOf(event);
      render();
    } else {
      const fallback = event.scales.findLast((name) => scaleButtons.some((button) => button.dataset.scale === name));
      if (!fallback) return false;
      adoptScale(fallback, id);
    }
    return true;
  }
  function step(direction: number) {
    const target = Math.min(visible.length - 1, Math.max(0, index + direction));
    if (target !== index) {
      index = target;
      render(undefined, true);
      onPick(visible[index].id);
    }
  }
  for (const button of scaleButtons) {
    button.addEventListener('click', () => {
      adoptScale(button.dataset.scale!, picker.value);
      onPick(visible[index].id);
    });
  }
  previous.addEventListener('click', () => { stop(); step(-1); });
  next.addEventListener('click', () => { stop(); step(1); });
  picker.addEventListener('change', () => {
    stop();
    select(picker.value);
    onPick(picker.value);
  });
  scrub.addEventListener('input', () => {
    stop();
    const position = scrub.valueAsNumber;
    const target = Math.max(0, visible.findLastIndex((card) => card.minute <= position));
    if (index === target) {
      render(position);
      return;
    }
    index = target;
    render(position, true);
    onPick(visible[index].id);
  });
  scrub.addEventListener('keydown', (event) => {
    if (scale === 'hours' || !['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    step(['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1);
  });
  play.addEventListener('click', () => {
    if (timer !== undefined) { stop(); return; }
    if (index === visible.length - 1) step(-index);
    play.textContent = 'Pause sequence';
    timer = window.setInterval(() => {
      if (!node.getClientRects().length || index === visible.length - 1) stop();
      else step(1);
    }, 1800);
  });
  adoptScale(scale);
  if (node.dataset.initial) select(node.dataset.initial);
  return { select, stop };
}

export function mountMap(node: HTMLElement, onPick: Pick) {
  const sheets = all(node, '[data-map-sheet]');
  const cards = all(node, '[data-place-card]');
  const pins = all(node, '[data-map-pin]');
  const regions = all(node, '[data-map-region]');
  const zoomButtons = all(node, '[data-map-zoom]');
  const picker = find<HTMLSelectElement>(node, '[data-place-picker]');
  const layerMenu = find<HTMLSelectElement>(node, '[data-map-layer]');
  const layerCaption = find(node, '[data-map-layer-caption]');
  let region = sheets.some((sheet) => sheet.dataset.mapSheet === node.dataset.initial)
    ? node.dataset.initial! : sheets[0].dataset.mapSheet!;
  let active = cards.find((card) => card.dataset.region === region)!;
  let viewport = find(node, '[data-map-window]');
  let zoom = 1;

  function magnify(to: number, anchorX = 0.5, anchorY = 0.5) {
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = viewport;
    const x = (scrollLeft + clientWidth * anchorX) / (scrollWidth || 1);
    const y = (scrollTop + clientHeight * anchorY) / (scrollHeight || 1);
    zoom = Math.max(1, Math.min(4, to));
    setZoom(viewport, zoom, 1, 4);
    viewport.scrollTo(x * viewport.scrollWidth - clientWidth * anchorX, y * viewport.scrollHeight - clientHeight * anchorY);
    viewport.tabIndex = zoom > 1 ? 0 : -1;
  }
  function shade() {
    layerCaption.textContent = layerMenu.selectedOptions[0]?.dataset.description ?? '';
    layerCaption.hidden = !layerCaption.textContent;
    for (const pin of pins) {
      pin.toggleAttribute('data-outside-layer', Boolean(layerMenu.value) && !pin.dataset.layers?.split(' ').includes(layerMenu.value));
    }
  }
  function showRegion(target: string) {
    region = target;
    pressed(regions, (button) => button.dataset.mapRegion === region);
    for (const sheet of sheets) sheet.hidden = sheet.dataset.mapSheet !== region;
    viewport = find(sheets.find((sheet) => sheet.dataset.mapSheet === region)!, '[data-map-window]');
    for (const option of picker.options) {
      option.hidden = option.dataset.region !== region;
      option.disabled = option.hidden;
    }
    magnify(1);
  }
  function select(id: string, layer?: string) {
    const card = cards.find((item) => item.dataset.placeCard === id);
    if (!card) return false;
    if (card.dataset.region !== region) showRegion(card.dataset.region!);
    active = card;
    for (const item of cards) item.hidden = item !== active;
    for (const pin of pins) {
      if (pin.dataset.mapPin === id) pin.setAttribute('aria-current', 'location');
      else pin.removeAttribute('aria-current');
    }
    picker.value = id;
    if (layer !== undefined) layerMenu.value = layer;
    shade();
    if (zoom > 1 && viewport.clientWidth) {
      const marker = pins.find((pin) => pin.dataset.mapPin === id)!.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      if (marker.left < bounds.left || marker.right > bounds.right || marker.top < bounds.top || marker.bottom > bounds.bottom) {
        viewport.scrollBy(marker.left + marker.width / 2 - bounds.left - bounds.width / 2,
          marker.top + marker.height / 2 - bounds.top - bounds.height / 2);
      }
    }
    return true;
  }
  for (const button of regions) {
    button.addEventListener('click', () => {
      const entry = cards.find((card) => card.dataset.region === button.dataset.mapRegion);
      if (entry) {
        select(entry.dataset.placeCard!, '');
        onPick(entry.dataset.placeCard!);
      }
    });
  }
  for (const button of zoomButtons) {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.mapZoom);
      magnify(direction === 0 ? 1 : zoom + direction * .5);
    });
  }
  function choose(id: string) {
    select(id);
    find(node, '[data-map-status]').textContent = find(active, '[data-record-heading]').textContent;
    onPick(id);
  }
  picker.addEventListener('change', () => choose(picker.value));
  layerMenu.addEventListener('change', shade);
  for (const pin of pins) {
    pin.addEventListener('click', (event) => {
      event.preventDefault();
      choose(pin.dataset.mapPin!);
    });
  }
  for (const view of all(node, '[data-map-window]')) {
    let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;
    let pinch: { scale: number; distance: number; x: number; y: number } | undefined;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    view.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.button !== 0 || zoom === 1 || (event.target as Element).closest('a')) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop };
      view.setPointerCapture(event.pointerId);
    });
    view.addEventListener('pointermove', (event) => {
      if (drag?.id === event.pointerId) view.scrollTo(drag.left - event.clientX + drag.x, drag.top - event.clientY + drag.y);
    });
    view.addEventListener('lostpointercapture', () => { drag = undefined; });
    view.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return;
      const bounds = view.getBoundingClientRect();
      const [a, b] = Array.from(event.touches);
      pinch = { scale: zoom, distance: distance(event.touches), x: ((a.clientX + b.clientX) / 2 - bounds.left) / bounds.width, y: ((a.clientY + b.clientY) / 2 - bounds.top) / bounds.height };
    }, { passive: true });
    view.addEventListener('touchmove', (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      magnify(pinch.scale * distance(event.touches) / Math.max(1, pinch.distance), pinch.x, pinch.y);
    }, { passive: false });
    view.addEventListener('touchend', () => { pinch = undefined; });
    view.addEventListener('touchcancel', () => { pinch = undefined; });
  }
  showRegion(region);
  select(active.dataset.placeCard!, '');
  return { select };
}

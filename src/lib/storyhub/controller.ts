import { referencePrefix, tools, type ClientReferences, type ReferenceKind, type References, type Tool } from './model';
import { all, find, mountAudio, mountCast, mountContext, mountMap, mountMedia, mountTimeline } from './widgets';

type Selection = { kind: ReferenceKind; id: string };
type RecordIndex = { id: string; refs: References; region?: string; layer?: string };
const order = Object.keys(referencePrefix) as ReferenceKind[];
const toolOf: Record<ReferenceKind, Tool> = {
  people: 'cast', events: 'timeline', places: 'map', notes: 'context', sources: 'context', media: 'context',
};

export function mountStory(root: HTMLElement) {
  const config = JSON.parse(find(root, '[data-story-config]').textContent!) as ClientReferences;
  const lookups = new Map(order.map((kind) => [
    kind, new Map<string, RecordIndex>(config[kind].map((row) => [row.id, row])),
  ]));
  const selection: Partial<Record<ReferenceKind, string>> = {};
  const panel = find<HTMLDialogElement>(root, '[data-companion]');
  const panelScroll = find(panel, '[data-panel-scroll]');
  const dock = find(root, '[data-companion-dock]');
  const panelTitle = find(panel, '[data-panel-title]');
  const panelChapter = find(panel, '[data-panel-chapter]');
  const chapterRefs = find<HTMLButtonElement>(panel, '[data-chapter-references]');
  const opening = root.querySelector<HTMLElement>('[data-story-opening]');
  const position = find(root, '[data-top-position]');
  const index = find<HTMLDetailsElement>(root, '[data-chapter-index]');
  const progress = find<HTMLProgressElement>(root, '[data-story-progress]');
  const chapters = all(root, '[data-story-chapter]');
  const chapterInfo = new Map(config.chapters.map((chapter, index) => [chapter.id, { ...chapter, position: index + 1 }]));
  const narrow = window.matchMedia('(max-width: 850px)');
  const settings = all<HTMLButtonElement>(root, '[data-setting]');
  const resume = root.querySelector<HTMLAnchorElement>('[data-resume-story]');
  const storageKey = 'grantdesk-reading:' + root.dataset.edition;
  let saved: { chapter?: string; text?: boolean; large?: boolean } = {};
  try { saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') ?? {}; } catch { /* Storage can be unavailable. */ }
  let active = '';
  let invoker: HTMLElement | null = null;
  let selectionChapter: string | undefined;
  let chapterMode = false;
  let frame = 0;

  const casts = all(root, '[data-cast]').map((node) => ({ node, view: mountCast(node, (id) => pick('people', id, node)) }));
  const timelines = all(root, '[data-timeline]').map((node) => ({ node, view: mountTimeline(node, (id) => pick('events', id, node)) }));
  const maps = all(root, '[data-map]').map((node) => ({ node, view: mountMap(node, (id) => pick('places', id, node)) }));
  const contexts = all(root, '[data-context]').map((node) => ({ node, view: mountContext(node, (kind, id) => pick(kind, id, node)) }));
  all(root, '[data-media-viewer]').filter((node) => !node.closest('[data-context]')).forEach((node) => mountMedia(node));
  all(root, '[data-historical-audio]').forEach(mountAudio);

  function sync(refs: References, primary?: Selection, origin?: HTMLElement) {
    for (const kind of order) {
      const next = kind === primary?.kind ? primary.id : refs[kind]?.[0];
      if (next) selection[kind] = next;
    }
    if (selection.people) for (const { node, view } of casts) {
      if (node !== origin) view.select(selection.people);
    }
    if (selection.events) for (const { node, view } of timelines) {
      if (node !== origin) view.select(selection.events);
    }
    // A place relationship determines the region. The event supplies the historical layer.
    if (selection.places) for (const { node, view } of maps) {
      const eventId = primary?.kind === 'events' ? primary.id : !primary ? refs.events?.[0] : undefined;
      const event = eventId ? lookups.get('events')?.get(eventId) : undefined;
      const isolate = primary?.kind === 'places' || primary?.kind === 'people';
      if (node !== origin) view.select(selection.places, event?.layer ?? (isolate || eventId ? '' : undefined));
    }
    for (const { node, view } of contexts) {
      if (node === origin) continue;
      if (refs.notes?.[0]) view.select('notes', refs.notes[0], false);
      if (refs.media?.[0]) view.select('media', refs.media[0], false);
      if (primary?.kind === 'notes' || primary?.kind === 'sources' || primary?.kind === 'media') {
        view.select(primary.kind, primary.id);
      } else if (!primary && refs.notes?.[0]) {
        view.collection('notes');
      }
    }
  }

  function pick(kind: ReferenceKind, id: string, origin?: HTMLElement) {
    const row = lookups.get(kind)?.get(id);
    if (!row) return false;
    selectionChapter = active;
    sync(row.refs, { kind, id }, origin);
    return true;
  }

  function save() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Reading still works when storage is blocked. */ }
  }
  function setChapter(id: string) {
    if (active === id) return;
    active = id;
    const chapter = chapterInfo.get(id);
    if (chapter) {
      saved.chapter = id;
      save();
    }
    progress.value = chapter?.position ?? 0;
    position.hidden = !chapter;
    position.textContent = chapter ? chapter.position + '/' + chapters.length : '';
    find(dock, '[data-chapter-count]').textContent = chapter ? 'Chapter ' + chapter.position + ' / ' + chapters.length : 'Chapter index';
    find(dock, '[data-dock-title]').textContent = chapter?.title ?? 'Historical briefing';
    panelChapter.textContent = chapter?.title ?? 'Historical briefing';
    chapterRefs.hidden = !chapter;
    for (const link of all(index, '[data-chapter-link]')) {
      if (link.dataset.chapterLink === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  function updateChapter() {
    frame = 0;
    const guide = window.innerHeight * 0.37;
    dock.hidden = Boolean(opening && opening.getBoundingClientRect().bottom > window.innerHeight * .75);
    const last = chapters.findLast((chapter) => !chapter.hidden && chapter.getBoundingClientRect().top <= guide);
    setChapter(last?.dataset.storyChapter ?? '');
  }
  function scheduleChapter() {
    if (!frame) frame = window.requestAnimationFrame(updateChapter);
  }
  function showChapter(id: string) {
    const chosen = chapterMode ? (chapterInfo.has(id) ? id : chapters[0].dataset.storyChapter) : '';
    for (const chapter of chapters) {
      chapter.hidden = Boolean(chosen) && chapter.dataset.storyChapter !== chosen;
      find(chapter, '[data-chapter-travel]').hidden = !chapterMode;
    }
  }
  function jumpChapter(id: string) {
    showChapter(id);
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ block: 'start', behavior: 'instant' });
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    setChapter(id);
  }
  function currentHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
  }
  function referenceAtHash(hash: string) {
    for (const kind of order) {
      const prefix = referencePrefix[kind] + '-';
      if (hash.startsWith(prefix) && lookups.get(kind)?.has(hash.slice(prefix.length))) return { kind, id: hash.slice(prefix.length) };
    }
    return undefined;
  }
  function followHash() {
    const key = currentHash();
    const reference = referenceAtHash(key);
    if (chapterInfo.has(key) && chapterMode) jumpChapter(key);
    if (reference) {
      const target = document.getElementById(key);
      pick(reference.kind, reference.id);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        target.querySelector<HTMLElement>('[data-record-heading]')?.focus({ preventScroll: true });
      }
    }
    scheduleChapter();
  }
  function reflectSettings() {
    const params = new URLSearchParams(location.search);
    chapterMode = root.dataset.modes?.includes('chapter') === true && params.get('mode') === 'chapter';
    const presentation = params.get('present') === '1';
    const enabled: Record<string, boolean> = { chapter: chapterMode, presentation, text: saved.text === true, large: saved.large === true };
    for (const button of settings) button.setAttribute('aria-pressed', String(enabled[button.dataset.setting!] ?? false));
    root.toggleAttribute('data-reading-text', enabled.text);
    root.toggleAttribute('data-reading-large', enabled.large);
    root.toggleAttribute('data-presenting', enabled.presentation);
    showChapter(currentHash() || active);
  }
  function setting(button: HTMLButtonElement) {
    const key = button.dataset.setting;
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    const url = new URL(location.href);
    if (key === 'chapter' || key === 'presentation') {
      const param = key === 'chapter' ? 'mode' : 'present';
      if (enabled) url.searchParams.set(param, key === 'chapter' ? 'chapter' : '1');
      else url.searchParams.delete(param);
      history.replaceState(history.state, '', url);
    } else if (key === 'text' || key === 'large') {
      saved[key] = enabled;
      save();
    }
    reflectSettings();
    scheduleChapter();
  }

  function chooseChapterReferences() {
    const refs = chapterInfo.get(active)?.refs;
    if (!refs) return;
    sync(refs);
    selectionChapter = active;
    panelScroll.scrollTop = 0;
  }

  function showPanel() {
    if (narrow.matches) panel.showModal();
    else panel.show();
  }

  function openTool(tool: Tool, trigger: HTMLElement, reference?: Selection) {
    const opening = !panel.open;
    // Reference selection can change the height of in-story tools above the
    // trigger. Save its screen position before synchronizing those tools.
    const readingTop = opening ? trigger.getBoundingClientRect().top : undefined;
    if (opening) invoker = trigger;
    if (reference) pick(reference.kind, reference.id);
    else if (opening && selectionChapter !== active) chooseChapterReferences();

    for (const section of all(panel, '[data-panel-tool]')) section.hidden = section.dataset.panelTool !== tool;
    for (const link of all(panel, '[data-open-tool]')) {
      if (link.dataset.openTool === tool) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    for (const link of all(dock, '[data-open-tool]')) link.setAttribute('aria-expanded', String(link.dataset.openTool === tool));
    panelTitle.textContent = tool[0].toUpperCase() + tool.slice(1);
    find(panel, '[data-complete-context]').hidden = tool !== 'context';
    if (tool !== 'timeline') {
      for (const { node, view } of timelines) if (panel.contains(node)) view.stop();
    }
    if (opening) {
      showPanel();
      find(panel, '.sh-close').focus({ preventScroll: true });
    }
    panelScroll.scrollTop = 0;
    if (reference && reference.kind === 'sources') {
      const detail = all<HTMLDetailsElement>(panel, '[data-source-card]').find((item) => item.dataset.sourceCard === reference.id);
      if (detail) {
        panelScroll.scrollTop = detail.getBoundingClientRect().top - panelScroll.getBoundingClientRect().top - 12;
        if (!opening) find(detail, 'summary').focus({ preventScroll: true });
      }
    }
    if (readingTop !== undefined) {
      // A browser may already have anchored the line. Correct only the actual
      // displacement now; closing must not undo later reader scroll or jumps.
      const displacement = trigger.getBoundingClientRect().top - readingTop;
      if (Math.abs(displacement) > 0.5) window.scrollBy({ top: displacement, behavior: 'instant' });
    }
  }

  panel.addEventListener('close', () => {
    if (panel.open) return;
    for (const link of all(dock, '[data-open-tool]')) link.setAttribute('aria-expanded', 'false');
    for (const { node, view } of timelines) if (panel.contains(node)) view.stop();
    invoker?.focus({ preventScroll: true });
    invoker = null;
  });
  narrow.addEventListener('change', () => {
    if (!panel.open) return;
    const top = panelScroll.scrollTop;
    const focused = panel.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    panel.close();
    showPanel();
    panelScroll.scrollTop = top;
    focused?.focus({ preventScroll: true });
  });
  chapterRefs.addEventListener('click', chooseChapterReferences);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.open && !panel.matches(':modal')) panel.close();
  });
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const link = event.target.closest<HTMLAnchorElement>('a');
    if (link?.hasAttribute('data-index-link')) index.open = true;
    if (link?.hasAttribute('data-close-and-jump')) {
      invoker = null;
      panel.close();
      return;
    }
    const trigger = event.target.closest<HTMLElement>('[data-open-tool], [data-reference-kind]');
    if (!trigger || typeof panel.showModal !== 'function') return;
    const kind = (trigger.dataset.referenceKind ?? trigger.dataset.openKind) as ReferenceKind | undefined;
    const id = trigger.dataset.referenceId ?? trigger.dataset.openId;
    const reference = kind && id && lookups.get(kind)?.has(id) ? { kind, id } : undefined;
    const tool = trigger.dataset.openTool as Tool | undefined ?? (kind ? toolOf[kind] : undefined);
    if (!tool || !(tool in tools)) return;
    event.preventDefault();
    openTool(tool, trigger, reference);
  });

  function unavailable(image: HTMLImageElement) {
    image.hidden = true;
    image.parentElement?.querySelector<HTMLElement>('[data-image-fallback]')?.removeAttribute('hidden');
  }
  root.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement && event.target.hasAttribute('data-archival-image')) unavailable(event.target);
  }, true);
  for (const image of all<HTMLImageElement>(root, '[data-archival-image]')) {
    if (image.complete && !image.naturalWidth) unavailable(image);
  }
  for (const button of settings) button.addEventListener('click', () => setting(button));
  for (const compare of all(root, '[data-photo-compare]')) {
    const grid = find(compare, '[data-comparison-grid]');
    const controls = all(compare, '[data-photo-view]');
    const sides = all(grid, '[data-comparison-side]');
    for (const button of controls) button.addEventListener('click', () => {
      const view = button.dataset.photoView!;
      grid.dataset.view = view;
      for (const control of controls) control.setAttribute('aria-pressed', String(control === button));
      for (const side of sides) side.hidden = view !== 'both' && side.dataset.comparisonSide !== view;
    });
  }
  for (const element of all(root, '[data-enhance]')) element.hidden = false;
  if (resume && saved.chapter && chapterInfo.has(saved.chapter)) {
    resume.href = '#' + saved.chapter;
    resume.textContent = 'Resume · ' + chapterInfo.get(saved.chapter)!.title;
    resume.hidden = false;
  }

  reflectSettings();
  followHash();
  window.addEventListener('scroll', scheduleChapter, { passive: true });
  window.addEventListener('resize', scheduleChapter, { passive: true });
  window.addEventListener('hashchange', followHash);
  window.addEventListener('popstate', reflectSettings);
}

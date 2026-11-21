export type ReferenceKind = 'people' | 'events' | 'places' | 'notes' | 'sources' | 'media';
export type References = Partial<Record<ReferenceKind, readonly string[]>>;
export type EvidenceKind = 'Primary record' | 'Archival photograph' | 'Later recollection' | 'Historical analysis' | 'Map data';
export type Evidence = { id: string; title: string; institution: string; url: string; kind: EvidenceKind; description: string };
export type Visual = {
  id: string; src: string; small?: string; width: number; height: number; alt: string; caption: string;
  credit: string; rights: string; source: string; transcript?: string[];
};
export type AudioRecord = {
  id: string; title: string; src: string; source: string; credit: string; rights: string;
  cues: { start: number; text: string; note?: string }[];
};
export type Person = {
  id: string; name: string; role: string; life?: string; overview: string; knew: string;
  decision: string; biography: string[]; visual: string; refs: References;
};
export type ChronologyScale = 'years' | 'months' | 'days' | 'hours';
export type Moment = {
  id: string; title: string; date: string; label: string; description: string; evidence: string;
  scales: ChronologyScale[]; refs: References; region?: string; layer?: string; visual?: string;
};
export type Place = {
  id: string; title: string; region: string; x: number; y: number; description: string;
  type: string; layers?: string[]; refs: References; visual?: string;
};
type MapPoint = { x: number; y: number };
export type MapRegion = {
  id: string; title: string; visual: string; description: string;
  labels?: (MapPoint & { name: string })[];
  movements?: { label: string; points: MapPoint[]; source: string }[];
};
export type MapLayer = { id: string; title: string; description: string };
export type ContextNote = { id: string; title: string; paragraphs: string[]; refs: References };
export type GlossaryTerm = { term: string; definition: string };
export type Scenario = { id: string; title: string; premise: string; documented: string; possibility: string; uncertainty: string; refs: References };
export type ReadingMode = 'scroll' | 'chapter';
export type Segment = string | { label: string; kind: ReferenceKind; id: string };
export type Chapter = {
  id: string; title: string; period: string; lead: string; paragraphs: Segment[][];
  visual?: string; refs: References; interaction?: string;
};
export type StoryEdition = {
  schema: 2;
  work: { id: string; title: string; subtitle: string; collection: string; question: string };
  edition: { id: string; route: string; language: string; summary: string; modes: ReadingMode[];
    publication: 'review' | 'public'; activity: { type: 'explore' } | { type: 'assignment-link'; href: string; saveIdentity: string } };
  briefing: { what: string[]; significance: string; scenarios: Scenario[] };
  chronology: { timeZone: string; scales: ChronologyScale[]; detailRange?: { start: string; end: string } };
  map: { regions: MapRegion[]; layers: MapLayer[]; initial: string };
  people: Person[]; events: Moment[]; places: Place[]; notes: ContextNote[]; sources: Evidence[]; media: Visual[];
  glossary: GlossaryTerm[]; chapters: Chapter[];
};

export const tools = {
  cast: ['people'],
  map: ['places'],
  timeline: ['events'],
  context: ['notes', 'sources', 'media'],
} as const satisfies Record<string, readonly ReferenceKind[]>;
export type Tool = keyof typeof tools;
export const referencePrefix: Record<ReferenceKind, string> = {
  people: 'person', events: 'event', places: 'place', notes: 'note', sources: 'source', media: 'media',
};

export function referenceAnchor(kind: ReferenceKind, id: string) {
  return '#' + referencePrefix[kind] + '-' + id;
}

export function titleOf(edition: StoryEdition, kind: ReferenceKind, id: string) {
  if (kind === 'people') return edition.people.find((entry) => entry.id === id)?.name;
  if (kind === 'media') return edition.media.find((entry) => entry.id === id)?.alt;
  return edition[kind].find((entry) => entry.id === id)?.title;
}

export function visualOf(edition: StoryEdition, id: string) {
  const visual = edition.media.find((entry) => entry.id === id);
  if (!visual) throw new Error('Missing media ' + id);
  return visual;
}

// Historical wall-clock dates are stored without an offset. UTC here is a sortable
// number line, so the student's device time zone cannot shift the historical date.
export function wallMinute(date: string) {
  return Date.parse(date.length === 10 ? date + 'T00:00:00Z' : date + ':00Z') / 60_000;
}

export function validateEdition(edition: StoryEdition) {
  const issues: string[] = [];
  const kinds = Object.keys(referencePrefix) as ReferenceKind[];
  const checkIds = (label: string, items: readonly { id: string }[]) => {
    const ids = new Set(items.map((item) => item.id));
    if (ids.size !== items.length || [...ids].some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))) issues.push(label + ' has invalid or duplicate IDs');
    return ids;
  };
  const regions = checkIds('map regions', edition.map.regions);
  const layers = checkIds('map layers', edition.map.layers);
  checkIds('chapters', edition.chapters);
  checkIds('scenarios', edition.briefing.scenarios);
  const ids = new Map(kinds.map((kind) => [kind, checkIds(kind, edition[kind])]));
  const requireRef = (kind: ReferenceKind, key: string, label: string) => {
    if (!ids.get(kind)?.has(key)) issues.push(label + ' refers to missing ' + kind + '/' + key);
  };
  const validateRefs = (record: { id: string; refs: References }) => {
    for (const kind of kinds) {
      for (const key of record.refs[kind] ?? []) requireRef(kind, key, record.id);
    }
  };
  const records = [...edition.people, ...edition.events, ...edition.places, ...edition.notes, ...edition.chapters, ...edition.briefing.scenarios];
  records.forEach(validateRefs);
  for (const record of records) {
    if ('visual' in record && record.visual) requireRef('media', record.visual, record.id);
  }
  for (const visual of edition.media) {
    requireRef('sources', visual.source, visual.id);
    if (!visual.rights || !visual.src.startsWith('/') || !visual.alt || visual.width <= 0 || visual.height <= 0) issues.push(visual.id + ' has incomplete media metadata');
  }
  for (const region of edition.map.regions) {
    requireRef('media', region.visual, region.id);
    for (const movement of region.movements ?? []) requireRef('sources', movement.source, region.id);
  }
  if (!regions.has(edition.map.initial)) issues.push('missing initial map region');
  if (!edition.chapters.length || !edition.people.length || !edition.notes.length || !edition.media.length) {
    issues.push('chapters, cast, context and archive each need at least one record');
  }
  if (!edition.chronology.scales.length || edition.chronology.scales.some((scale) => !edition.events.some((event) => event.scales.includes(scale)))) {
    issues.push('each timeline scale needs at least one event');
  }
  if (edition.map.regions.some((region) => !edition.places.some((place) => place.region === region.id))) {
    issues.push('each map sheet needs at least one place');
  }
  for (const place of edition.places) {
    if (!regions.has(place.region) || ![place.x, place.y].every((value) => value >= 0 && value <= 100)) issues.push(place.id + ' lies outside the defined regions');
    if (place.layers?.some((layer) => !layers.has(layer))) issues.push(place.id + ' has an unknown map layer');
  }
  for (const event of edition.events) {
    if (!Number.isFinite(wallMinute(event.date)) || !event.scales.length || event.scales.some((scale) => !edition.chronology.scales.includes(scale))) issues.push(event.id + ' has an invalid historical date or scale');
    if (event.region && !regions.has(event.region)) issues.push(event.id + ' has an unknown map region');
    if (event.layer && !layers.has(event.layer)) issues.push(event.id + ' has an unknown map layer');
  }
  for (const chapter of edition.chapters) {
    for (const segment of chapter.paragraphs.flat()) {
      if (typeof segment !== 'string') requireRef(segment.kind, segment.id, chapter.id);
    }
  }
  if (issues.length) throw new Error('Story edition ' + edition.edition.id + ' is invalid:\n' + issues.join('\n'));
}

export function clientReferences(edition: StoryEdition) {
  return {
    chapters: edition.chapters.map(({ id, title, refs }) => ({ id, title, refs })),
    people: edition.people.map(({ id, refs }) => ({ id, refs })),
    events: edition.events.map(({ id, refs, region, layer }) => ({ id, refs, region, layer })),
    places: edition.places.map(({ id, refs, region }) => ({ id, refs, region })),
    notes: edition.notes.map(({ id, refs }) => ({ id, refs })),
    sources: edition.sources.map(({ id }) => ({ id, refs: {} as References })),
    media: edition.media.map(({ id, source }) => ({ id, refs: { sources: [source] } as References })),
  };
}
export type ClientReferences = ReturnType<typeof clientReferences>;

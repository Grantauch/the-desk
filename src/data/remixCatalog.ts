import publicCatalog from './remix-public.json';

export const remixCourses = [
  {
    slug: 'us-history-9',
    title: 'u.s. history 9',
    label: '180 days · 18 blocks',
    description: 'reconstruction through the present, organized by block and course day.',
  },
  {
    slug: 'hidden-history',
    title: 'hidden history',
    label: '90 days · 9 blocks',
    description: 'claims, evidence, source limits, and bounded verdicts.',
  },
  {
    slug: 'beyond-the-scoreboard',
    title: 'beyond the scoreboard',
    label: '90 days · 9 blocks',
    description: 'power, money, race, media, law, and access through sport.',
  },
] as const;

export type RemixCourseSlug = (typeof remixCourses)[number]['slug'];
export type RemixWeekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type RemixProductionStatus = 'Content Complete - Source Checked' | 'Published - Student Ready';

export interface RemixRecord {
  courseSlug: RemixCourseSlug;
  block: number;
  courseDay: number;
  week: number;
  weekday: RemixWeekday;
  role: string;
  lectureNumber: number | null;
  title: string;
  unitArc: string;
  courseQuestion: string;
  productionStatus: RemixProductionStatus;
  audience: 'student';
  access: 'verified-student-access';
  rightsStatus: 'cleared';
  href: string;
  version: string;
  isCurrent: true;
}

interface RemixCatalogFile {
  version: number;
  updated: string;
  records: unknown[];
}

const catalog = publicCatalog as unknown as RemixCatalogFile;
const allowedCourseSlugs = new Set<string>(remixCourses.map((course) => course.slug));
const allowedWeekdays = new Set<RemixWeekday>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
const allowedStatuses = new Set<RemixProductionStatus>([
  'Content Complete - Source Checked',
  'Published - Student Ready',
]);
const forbiddenPublicLanguage = /teacher|answer\s*key|forms?\s*builder|item\s*bank|source\s*register|confidential|\bqa\b|\bquiz\b|\btest\b|\bfinal\b/i;
const forbiddenFields = /localSourcePath|teacher|answer|key|builder|confidential|private|sourceRegister|qaRecord/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isPositiveInteger = (value: unknown) => Number.isInteger(value) && Number(value) > 0;
const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

function validateRecord(value: unknown, index: number): string[] {
  const prefix = `remix-public record ${index + 1}`;
  if (!isObject(value)) return [`${prefix} must be an object`];

  const errors: string[] = [];
  const text = (field: string) => value[field];
  if (!allowedCourseSlugs.has(String(text('courseSlug')))) errors.push(`${prefix}: invalid courseSlug`);
  for (const field of ['block', 'courseDay', 'week']) {
    if (!isPositiveInteger(text(field))) errors.push(`${prefix}: ${field} must be a positive integer`);
  }
  if (!allowedWeekdays.has(text('weekday') as RemixWeekday)) errors.push(`${prefix}: invalid weekday`);
  if (text('lectureNumber') !== null && !isPositiveInteger(text('lectureNumber'))) {
    errors.push(`${prefix}: lectureNumber must be a positive integer or null`);
  }
  for (const field of ['role', 'title', 'unitArc', 'courseQuestion']) {
    if (!isNonEmptyString(text(field))) errors.push(`${prefix}: ${field} is required`);
  }
  if (!allowedStatuses.has(text('productionStatus') as RemixProductionStatus)) {
    errors.push(`${prefix}: productionStatus has not passed the public maturity gate`);
  }
  if (text('audience') !== 'student') errors.push(`${prefix}: audience must be student`);
  if (text('access') !== 'verified-student-access') errors.push(`${prefix}: student access is not verified`);
  if (text('rightsStatus') !== 'cleared') errors.push(`${prefix}: rightsStatus must be cleared`);
  if (text('isCurrent') !== true) errors.push(`${prefix}: only the current additive version may be public`);
  if (!isNonEmptyString(text('version')) || !/^v\d+(?:\.\d+)?$/i.test(String(text('version')))) {
    errors.push(`${prefix}: version must look like v1 or v1.1`);
  }

  if (!isNonEmptyString(text('href'))) {
    errors.push(`${prefix}: href is required`);
  } else {
    try {
      const url = new URL(String(text('href')));
      if (url.protocol !== 'https:' || !['docs.google.com', 'drive.google.com'].includes(url.hostname)) {
        errors.push(`${prefix}: href must be an HTTPS Google Docs or Drive link`);
      }
    } catch {
      errors.push(`${prefix}: href is not a valid URL`);
    }
  }

  if (forbiddenPublicLanguage.test(`${String(text('role') ?? '')} ${String(text('title') ?? '')}`)) {
    errors.push(`${prefix}: role/title looks teacher-only, confidential, or assessment-restricted`);
  }
  for (const field of Object.keys(value)) {
    if (forbiddenFields.test(field)) errors.push(`${prefix}: forbidden public field ${field}`);
  }
  return errors;
}

const validationErrors = [
  ...(catalog.version === 1 ? [] : ['remix-public catalog version must be 1']),
  ...(Array.isArray(catalog.records) ? [] : ['remix-public records must be an array']),
  ...(Array.isArray(catalog.records) ? catalog.records.flatMap(validateRecord) : []),
];

const currentKeys = new Set<string>();
if (Array.isArray(catalog.records)) {
  for (const [index, value] of catalog.records.entries()) {
    if (!isObject(value)) continue;
    const key = `${String(value.courseSlug)}:${String(value.courseDay)}`;
    if (currentKeys.has(key)) validationErrors.push(`remix-public record ${index + 1}: duplicate current course day ${key}`);
    currentKeys.add(key);
  }
}

if (validationErrors.length > 0) {
  throw new Error(`Public remix catalog failed validation:\n- ${validationErrors.join('\n- ')}`);
}

export const remixRecords = [...(catalog.records as RemixRecord[])].sort(
  (a, b) =>
    remixCourses.findIndex((course) => course.slug === a.courseSlug) -
      remixCourses.findIndex((course) => course.slug === b.courseSlug) ||
    a.courseDay - b.courseDay,
);

export const remixPublicRoutes = remixRecords.length
  ? [
      '/remix/',
      ...remixCourses
        .filter((course) => remixRecords.some((record) => record.courseSlug === course.slug))
        .map((course) => `/remix/${course.slug}/`),
      ...Array.from(new Set(remixRecords.map((record) => `/remix/${record.courseSlug}/${record.block}/`))),
    ]
  : [];

export const recordsForCourse = (courseSlug: RemixCourseSlug) =>
  remixRecords.filter((record) => record.courseSlug === courseSlug);

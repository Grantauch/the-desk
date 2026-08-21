import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'src', 'data', 'remix-public.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const courseSlugs = new Set(['us-history-9', 'hidden-history', 'beyond-the-scoreboard']);
const weekdays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
const statuses = new Set(['Content Complete - Source Checked', 'Published - Student Ready']);
const forbiddenPublicLanguage = /teacher|answer\s*key|forms?\s*builder|item\s*bank|source\s*register|confidential|\bqa\b|\bquiz\b|\btest\b|\bfinal\b/i;
const forbiddenFields = /localSourcePath|teacher|answer|key|builder|confidential|private|sourceRegister|qaRecord/i;
const errors = [];
const seen = new Set();

if (catalog.version !== 1) errors.push('catalog version must be 1');
if (!Array.isArray(catalog.records)) errors.push('records must be an array');

for (const [index, record] of (catalog.records || []).entries()) {
  const label = `record ${index + 1}`;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push(`${label}: must be an object`);
    continue;
  }
  if (!courseSlugs.has(record.courseSlug)) errors.push(`${label}: invalid courseSlug`);
  for (const field of ['block', 'courseDay', 'week']) {
    if (!Number.isInteger(record[field]) || record[field] < 1) errors.push(`${label}: invalid ${field}`);
  }
  if (!weekdays.has(record.weekday)) errors.push(`${label}: invalid weekday`);
  if (record.lectureNumber !== null && (!Number.isInteger(record.lectureNumber) || record.lectureNumber < 1)) {
    errors.push(`${label}: invalid lectureNumber`);
  }
  for (const field of ['role', 'title', 'unitArc', 'courseQuestion']) {
    if (typeof record[field] !== 'string' || !record[field].trim()) errors.push(`${label}: missing ${field}`);
  }
  if (!statuses.has(record.productionStatus)) errors.push(`${label}: production status is not public-ready`);
  if (record.audience !== 'student') errors.push(`${label}: audience must be student`);
  if (record.access !== 'verified-student-access') errors.push(`${label}: access is not verified`);
  if (record.rightsStatus !== 'cleared') errors.push(`${label}: rights are not cleared`);
  if (record.isCurrent !== true) errors.push(`${label}: record is not current`);
  if (typeof record.version !== 'string' || !/^v\d+(?:\.\d+)?$/i.test(record.version)) errors.push(`${label}: invalid version`);
  try {
    const url = new URL(record.href);
    if (url.protocol !== 'https:' || !['docs.google.com', 'drive.google.com'].includes(url.hostname)) {
      errors.push(`${label}: href must be an HTTPS Google Docs or Drive link`);
    }
  } catch {
    errors.push(`${label}: invalid href`);
  }
  if (forbiddenPublicLanguage.test(`${record.role || ''} ${record.title || ''}`)) {
    errors.push(`${label}: teacher-only, confidential, or assessment-restricted language`);
  }
  for (const field of Object.keys(record)) {
    if (forbiddenFields.test(field)) errors.push(`${label}: forbidden field ${field}`);
  }
  const key = `${record.courseSlug}:${record.courseDay}`;
  if (seen.has(key)) errors.push(`${label}: duplicate current course day ${key}`);
  seen.add(key);
}

if (errors.length) {
  console.error(`Public remix catalog failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Public remix catalog: PASS (${catalog.records.length} student-ready records)`);

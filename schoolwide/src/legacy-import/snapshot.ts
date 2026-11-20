import { createHash } from 'node:crypto';
import {
  LegacyImportError,
  legacySurfaceNames,
  type LegacyRow,
  type LegacySnapshot,
  type LegacySnapshotFingerprint,
  type LegacySurfaceName,
} from './types.js';

const MAX_ROWS_PER_SURFACE = 50_000;
const MAX_ROW_KEYS = 100;
const MAX_STRING_LENGTH = 8_000;
const MAX_DEPTH = 6;
const SOURCE_ALIAS = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const FORBIDDEN_KEYS = new Set([
  'pin','plaintextpin','pin_salt','pinsalt','secrethash','credentialhash','actionproof',
  'accesstoken','refreshtoken','clientsecret','codeverifier','oauthtoken','password',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inspectValue(value: unknown, depth: number, path: string): void {
  if (depth > MAX_DEPTH) throw new LegacyImportError('LEGACY_SNAPSHOT_TOO_DEEP', `Snapshot value at ${path} is nested too deeply.`);
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) throw new LegacyImportError('LEGACY_SNAPSHOT_VALUE_TOO_LARGE', `Snapshot string at ${path} exceeds the allowed size.`);
    return;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    if (value.length > 1_000) throw new LegacyImportError('LEGACY_SNAPSHOT_VALUE_TOO_LARGE', `Snapshot array at ${path} is too large.`);
    value.forEach((entry, index) => inspectValue(entry, depth + 1, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > MAX_ROW_KEYS) throw new LegacyImportError('LEGACY_SNAPSHOT_ROW_TOO_WIDE', `Snapshot object at ${path} has too many fields.`);
    for (const [key, entry] of entries) {
      if (key.length > 100) throw new LegacyImportError('LEGACY_SNAPSHOT_FIELD_INVALID', `Snapshot field at ${path} has an invalid name.`);
      if (FORBIDDEN_KEYS.has(key.replaceAll('-', '').replaceAll('_', '').toLowerCase())) {
        throw new LegacyImportError('LEGACY_SECRET_MATERIAL_FORBIDDEN', `Secret credential material is not accepted in the SW-140 general snapshot (${key}).`);
      }
      inspectValue(entry, depth + 1, `${path}.${key}`);
    }
    return;
  }
  throw new LegacyImportError('LEGACY_SNAPSHOT_VALUE_INVALID', `Snapshot value at ${path} has an unsupported type.`);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableSnapshotJson(snapshot: LegacySnapshot): string {
  return JSON.stringify(stableValue(snapshot));
}

function nonEmptyString(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string') throw new LegacyImportError('LEGACY_SNAPSHOT_METADATA_INVALID', `${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new LegacyImportError('LEGACY_SNAPSHOT_METADATA_INVALID', `${field} is missing or too long.`);
  return trimmed;
}

function parseMetadata(value: unknown): LegacySnapshot['metadata'] {
  if (!isPlainObject(value)) throw new LegacyImportError('LEGACY_SNAPSHOT_METADATA_INVALID', 'Snapshot metadata is required.');
  const allowed = new Set(['sourceAlias','schemaVersion','exportedAt','highWaterMark']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new LegacyImportError('LEGACY_SNAPSHOT_METADATA_INVALID', `Unknown snapshot metadata field: ${key}.`);
  const sourceAlias = nonEmptyString(value.sourceAlias, 'sourceAlias', 100);
  if (!SOURCE_ALIAS.test(sourceAlias)) throw new LegacyImportError('LEGACY_SOURCE_ALIAS_INVALID', 'sourceAlias must be a controlled non-secret alias, not a URL or workbook identifier.');
  const schemaVersion = nonEmptyString(value.schemaVersion, 'schemaVersion', 100);
  const exportedAt = nonEmptyString(value.exportedAt, 'exportedAt', 100);
  if (Number.isNaN(Date.parse(exportedAt))) throw new LegacyImportError('LEGACY_SNAPSHOT_METADATA_INVALID', 'exportedAt must be an ISO timestamp.');
  const highWaterMark = value.highWaterMark === undefined ? undefined : nonEmptyString(value.highWaterMark, 'highWaterMark', 200);
  return highWaterMark === undefined ? { sourceAlias, schemaVersion, exportedAt } : { sourceAlias, schemaVersion, exportedAt, highWaterMark };
}

function parseSurfaces(value: unknown): LegacySnapshot['surfaces'] {
  if (!isPlainObject(value)) throw new LegacyImportError('LEGACY_SNAPSHOT_SURFACES_INVALID', 'Snapshot surfaces are required.');
  const expected = new Set<string>(legacySurfaceNames);
  for (const key of Object.keys(value)) if (!expected.has(key)) throw new LegacyImportError('LEGACY_SNAPSHOT_SURFACES_INVALID', `Unknown legacy surface: ${key}.`);
  const surfaces = {} as Record<LegacySurfaceName, readonly LegacyRow[]>;
  for (const name of legacySurfaceNames) {
    const rows = value[name];
    if (!Array.isArray(rows)) throw new LegacyImportError('LEGACY_SNAPSHOT_SURFACE_MISSING', `Legacy surface ${name} must be present as an array; empty arrays are allowed.`);
    if (rows.length > MAX_ROWS_PER_SURFACE) throw new LegacyImportError('LEGACY_SNAPSHOT_SURFACE_TOO_LARGE', `Legacy surface ${name} exceeds ${MAX_ROWS_PER_SURFACE} rows.`);
    const parsed: LegacyRow[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!isPlainObject(row)) throw new LegacyImportError('LEGACY_SNAPSHOT_ROW_INVALID', `${name}[${index}] must be an object.`);
      inspectValue(row, 0, `${name}[${index}]`);
      if (name === 'credentialCoverage') {
        const allowed = new Set(['studentKey','hasCredential','algorithm','credentialVersion']);
        for (const key of Object.keys(row)) if (!allowed.has(key)) throw new LegacyImportError('LEGACY_CREDENTIAL_COVERAGE_INVALID', `credentialCoverage may contain coverage metadata only; field ${key} is not allowed.`);
        if (typeof row.hasCredential !== 'boolean') throw new LegacyImportError('LEGACY_CREDENTIAL_COVERAGE_INVALID', 'credentialCoverage.hasCredential must be boolean.');
      }
      parsed.push(Object.freeze({ ...row }));
    }
    surfaces[name] = Object.freeze(parsed);
  }
  return Object.freeze(surfaces);
}

export function parseLegacySnapshot(input: unknown): LegacySnapshot {
  if (!isPlainObject(input)) throw new LegacyImportError('LEGACY_SNAPSHOT_INVALID', 'Legacy snapshot must be a JSON object.');
  const allowed = new Set(['metadata','surfaces']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new LegacyImportError('LEGACY_SNAPSHOT_INVALID', `Unknown snapshot field: ${key}.`);
  return Object.freeze({ metadata: parseMetadata(input.metadata), surfaces: parseSurfaces(input.surfaces) });
}

export function fingerprintLegacySnapshot(snapshot: LegacySnapshot): LegacySnapshotFingerprint {
  const rowCounts = Object.fromEntries(legacySurfaceNames.map((name) => [name, snapshot.surfaces[name].length])) as Record<LegacySurfaceName, number>;
  return Object.freeze({
    algorithm: 'SHA256',
    value: createHash('sha256').update(stableSnapshotJson(snapshot), 'utf8').digest('hex'),
    sourceAlias: snapshot.metadata.sourceAlias,
    schemaVersion: snapshot.metadata.schemaVersion,
    exportedAt: snapshot.metadata.exportedAt,
    highWaterMark: snapshot.metadata.highWaterMark ?? null,
    rowCounts: Object.freeze(rowCounts),
  });
}

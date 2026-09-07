import type { QueryResultRow } from 'pg';
import type { Database } from '../db/database.js';
import type {
  CalendarProvenance,
  EffectivePolicyValue,
  JsonValue,
  PeriodProvenance,
  PolicyResolution,
  RejectedSectionOverride,
  SchedulePolicyContext,
  SchoolLocalClock,
  SessionResolution,
  StudentAccessResolution,
} from './types.js';

interface SectionRow extends QueryResultRow {
  section_id: string;
  school_id: string;
  academic_year_id: string;
  period_code: string | null;
  timezone: string;
  year_starts_on: string | Date;
  year_ends_on: string | Date;
}

interface CalendarRow extends QueryResultRow {
  calendar_day_id: string;
  academic_date: string | Date;
  is_school_day: boolean;
  schedule_profile_id: string | null;
  label: string | null;
  source: string;
  source_revision: string | null;
  schedule_profile_key: string | null;
  schedule_profile_status: string | null;
}

interface PeriodRow extends QueryResultRow {
  period_id: string;
  period_code: string;
  starts_at_local: string;
  ends_at_local: string;
  ordinal_by_time: number;
}

interface PolicySetRow extends QueryResultRow {
  id: string;
  academic_year_id: string;
  name: string;
  effective_from: string | Date;
  effective_until: string | Date | null;
}

interface PolicyValueRow extends QueryResultRow {
  id: string;
  policy_key: string;
  typed_value_json: unknown;
  teacher_override_allowed: boolean;
  validation_schema_version: number;
}

interface OverrideRow extends QueryResultRow {
  id: string;
  policy_key: string;
  typed_value_json: unknown;
}

interface StudentAccessRow extends QueryResultRow {
  id: string;
  section_id: string | null;
  access_mode: 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY';
}

function databaseDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function parseDatabaseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
  return hour * 3600 + minute * 60 + second + fraction;
}

function localClock(instant: Date, timezone: string): SchoolLocalClock {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid instant.');
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  const hour = values.get('hour');
  const minute = values.get('minute');
  const second = values.get('second');
  if (!year || !month || !day || !hour || !minute || !second) throw new RangeError('Timezone conversion failed.');

  return {
    instant: instant.toISOString(),
    timezone,
    academicDate: `${year}-${month}-${day}`,
    localTime: `${hour}:${minute}:${second}`,
    localSecondOfDay: Number(hour) * 3600
      + Number(minute) * 60
      + Number(second)
      + instant.getUTCMilliseconds() / 1000,
  };
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function isUsablePolicyValue(value: unknown): value is Exclude<JsonValue, null> {
  return value !== null && isJsonValue(value);
}

function calendarProvenance(row: CalendarRow): CalendarProvenance {
  return {
    calendarDayId: row.calendar_day_id,
    academicDate: databaseDate(row.academic_date),
    isSchoolDay: row.is_school_day,
    scheduleProfileId: row.schedule_profile_id,
    scheduleProfileKey: row.schedule_profile_key,
    label: row.label,
    source: row.source,
    sourceRevision: row.source_revision,
  };
}

function periodProvenance(row: PeriodRow): PeriodProvenance {
  return {
    periodId: row.period_id,
    periodCode: row.period_code,
    ordinalByTime: row.ordinal_by_time,
    startsAtLocal: row.starts_at_local,
    endsAtLocal: row.ends_at_local,
  };
}

export class SchedulePolicyService {
  readonly #database: Database;

  constructor(database: Database) {
    this.#database = database;
  }

  async resolveSectionSession(sectionId: string, at: Date): Promise<SessionResolution> {
    const sections = await this.#database.query<SectionRow>(
      `SELECT sec.id AS section_id,
              sec.school_id,
              sec.academic_year_id,
              sec.period_code,
              s.timezone,
              ay.starts_on AS year_starts_on,
              ay.ends_on AS year_ends_on
         FROM sections sec
         JOIN schools s
           ON s.id = sec.school_id
          AND s.status = 'ACTIVE'
         JOIN academic_years ay
           ON ay.school_id = sec.school_id
          AND ay.id = sec.academic_year_id
          AND ay.status = 'ACTIVE'
        WHERE sec.id = $1
          AND sec.status = 'ACTIVE'`,
      [sectionId],
    );
    const section = sections[0];
    if (!section) return { status: 'NO_ACTIVE_SESSION', sectionId, reason: 'SECTION_NOT_FOUND_OR_INACTIVE' };

    let clock: SchoolLocalClock;
    try {
      clock = localClock(at, section.timezone);
    } catch {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        reason: 'TIMEZONE_INVALID',
      };
    }

    const yearStarts = databaseDate(section.year_starts_on);
    const yearEnds = databaseDate(section.year_ends_on);
    if (clock.academicDate < yearStarts || clock.academicDate > yearEnds) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        reason: 'SECTION_ACADEMIC_YEAR_MISMATCH',
      };
    }

    const calendarRows = await this.#database.query<CalendarRow>(
      `SELECT cal.id AS calendar_day_id,
              cal.academic_date,
              cal.is_school_day,
              cal.schedule_profile_id,
              cal.label,
              cal.source,
              cal.source_revision,
              sp.key AS schedule_profile_key,
              sp.status AS schedule_profile_status
         FROM school_calendar_days cal
         LEFT JOIN schedule_profiles sp
           ON sp.school_id = cal.school_id
          AND sp.id = cal.schedule_profile_id
        WHERE cal.school_id = $1
          AND cal.academic_date = $2::date`,
      [section.school_id, clock.academicDate],
    );
    const calendarRow = calendarRows[0];
    if (!calendarRow) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        reason: 'CALENDAR_DAY_MISSING',
      };
    }
    const calendar = calendarProvenance(calendarRow);

    if (!calendarRow.is_school_day) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        reason: 'NO_SCHOOL',
      };
    }
    if (!calendarRow.schedule_profile_id) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        reason: 'SCHEDULE_PROFILE_MISSING',
      };
    }
    if (calendarRow.schedule_profile_status !== 'ACTIVE') {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        reason: 'SCHEDULE_PROFILE_INACTIVE',
      };
    }
    if (!section.period_code) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        reason: 'SECTION_PERIOD_UNCONFIGURED',
      };
    }

    const periodRows = await this.#database.query<PeriodRow>(
      `SELECT id AS period_id, period_code, starts_at_local, ends_at_local, ordinal_by_time
         FROM schedule_periods
        WHERE school_id = $1
          AND schedule_profile_id = $2
          AND period_code = $3
        ORDER BY ordinal_by_time, id`,
      [section.school_id, calendarRow.schedule_profile_id, section.period_code],
    );
    const periodRow = periodRows[0];
    if (!periodRow) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        reason: 'SECTION_PERIOD_NOT_IN_PROFILE',
      };
    }

    const period = periodProvenance(periodRow);
    const startsAt = parseDatabaseTime(periodRow.starts_at_local);
    const endsAt = parseDatabaseTime(periodRow.ends_at_local);
    if (startsAt === null || endsAt === null || endsAt <= startsAt) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        period,
        reason: 'SECTION_PERIOD_NOT_IN_PROFILE',
      };
    }
    if (clock.localSecondOfDay < startsAt || clock.localSecondOfDay >= endsAt) {
      return {
        status: 'NO_ACTIVE_SESSION',
        sectionId,
        schoolId: section.school_id,
        academicYearId: section.academic_year_id,
        clock,
        calendar,
        period,
        reason: 'OUTSIDE_SECTION_PERIOD',
      };
    }

    return {
      status: 'IN_SESSION',
      schoolId: section.school_id,
      sectionId,
      academicYearId: section.academic_year_id,
      clock,
      calendar,
      period,
    };
  }

  async resolvePolicy(input: {
    schoolId: string;
    sectionId: string;
    academicYearId: string;
    academicDate: string;
    at: Date;
    studentId?: string;
  }): Promise<PolicyResolution> {
    const policySets = await this.#database.query<PolicySetRow>(
      `SELECT id, academic_year_id, name, effective_from, effective_until
         FROM school_policy_sets
        WHERE school_id = $1
          AND academic_year_id = $2
          AND active = true
          AND effective_from <= $3::date
          AND (effective_until IS NULL OR effective_until >= $3::date)
        ORDER BY effective_from DESC, id`,
      [input.schoolId, input.academicYearId, input.academicDate],
    );

    if (policySets.length === 0) {
      return {
        status: 'UNRESOLVED',
        schoolId: input.schoolId,
        sectionId: input.sectionId,
        academicDate: input.academicDate,
        reason: 'NO_EFFECTIVE_POLICY_SET',
      };
    }
    if (policySets.length !== 1) {
      return {
        status: 'UNRESOLVED',
        schoolId: input.schoolId,
        sectionId: input.sectionId,
        academicDate: input.academicDate,
        reason: 'CONFLICTING_POLICY_SETS',
      };
    }

    const policySet = policySets[0]!;
    const policyValues = await this.#database.query<PolicyValueRow>(
      `SELECT id, policy_key, typed_value_json, teacher_override_allowed, validation_schema_version
         FROM policy_values
        WHERE school_id = $1
          AND policy_set_id = $2
        ORDER BY policy_key`,
      [input.schoolId, policySet.id],
    );
    if (policyValues.some((row) => row.validation_schema_version !== 1 || !isUsablePolicyValue(row.typed_value_json))) {
      return {
        status: 'UNRESOLVED',
        schoolId: input.schoolId,
        sectionId: input.sectionId,
        academicDate: input.academicDate,
        reason: 'MALFORMED_POLICY_VALUE',
      };
    }

    const defaults = new Map(policyValues.map((row) => [row.policy_key, row]));
    const values: Record<string, EffectivePolicyValue> = {};
    for (const row of policyValues) {
      values[row.policy_key] = {
        policyKey: row.policy_key,
        value: row.typed_value_json as Exclude<JsonValue, null>,
        source: 'SCHOOL_DEFAULT',
        policyValueId: row.id,
      };
    }

    const overrides = await this.#database.query<OverrideRow>(
      `SELECT id, policy_key, typed_value_json
         FROM section_policy_overrides
        WHERE school_id = $1
          AND section_id = $2
          AND valid_from <= $3::timestamptz
          AND (valid_until IS NULL OR valid_until > $3::timestamptz)
        ORDER BY policy_key, valid_from DESC, id`,
      [input.schoolId, input.sectionId, input.at.toISOString()],
    );
    const overrideGroups = new Map<string, OverrideRow[]>();
    for (const row of overrides) {
      const group = overrideGroups.get(row.policy_key) ?? [];
      group.push(row);
      overrideGroups.set(row.policy_key, group);
    }

    const rejectedSectionOverrides: RejectedSectionOverride[] = [];
    for (const [policyKey, group] of overrideGroups) {
      const schoolDefault = defaults.get(policyKey);
      if (!schoolDefault) {
        for (const override of group) {
          rejectedSectionOverrides.push({ overrideId: override.id, policyKey, reason: 'NO_SCHOOL_DEFAULT' });
        }
        continue;
      }
      if (!schoolDefault.teacher_override_allowed) {
        for (const override of group) {
          rejectedSectionOverrides.push({ overrideId: override.id, policyKey, reason: 'TEACHER_OVERRIDE_NOT_ALLOWED' });
        }
        continue;
      }
      if (group.length !== 1) {
        for (const override of group) {
          rejectedSectionOverrides.push({ overrideId: override.id, policyKey, reason: 'CONFLICTING_ACTIVE_OVERRIDES' });
        }
        continue;
      }
      const override = group[0]!;
      if (!isUsablePolicyValue(override.typed_value_json)) {
        rejectedSectionOverrides.push({ overrideId: override.id, policyKey, reason: 'MALFORMED_OVERRIDE_VALUE' });
        continue;
      }
      values[policyKey] = {
        policyKey,
        value: override.typed_value_json,
        source: 'SECTION_OVERRIDE',
        policyValueId: schoolDefault.id,
        overrideId: override.id,
      };
    }

    const accessInput: { schoolId: string; sectionId: string; at: Date; studentId?: string } = {
      schoolId: input.schoolId,
      sectionId: input.sectionId,
      at: input.at,
    };
    if (input.studentId !== undefined) accessInput.studentId = input.studentId;
    const studentAccess = await this.#resolveStudentAccess(accessInput);

    return {
      status: 'RESOLVED',
      schoolId: input.schoolId,
      sectionId: input.sectionId,
      academicDate: input.academicDate,
      policySet: {
        id: policySet.id,
        academicYearId: policySet.academic_year_id,
        name: policySet.name,
        effectiveFrom: databaseDate(policySet.effective_from),
        effectiveUntil: policySet.effective_until ? databaseDate(policySet.effective_until) : null,
      },
      values,
      rejectedSectionOverrides,
      studentAccess,
    };
  }

  async resolveContext(input: { sectionId: string; at: Date; studentId?: string }): Promise<SchedulePolicyContext> {
    const session = await this.resolveSectionSession(input.sectionId, input.at);
    if (!session.schoolId || !session.academicYearId || !session.clock) return { session, policy: null };

    const policyInput: {
      schoolId: string;
      sectionId: string;
      academicYearId: string;
      academicDate: string;
      at: Date;
      studentId?: string;
    } = {
      schoolId: session.schoolId,
      sectionId: input.sectionId,
      academicYearId: session.academicYearId,
      academicDate: session.clock.academicDate,
      at: input.at,
    };
    if (input.studentId !== undefined) policyInput.studentId = input.studentId;
    return { session, policy: await this.resolvePolicy(policyInput) };
  }

  async #resolveStudentAccess(input: {
    schoolId: string;
    sectionId: string;
    studentId?: string;
    at: Date;
  }): Promise<StudentAccessResolution> {
    if (!input.studentId) return { status: 'NONE' };

    const memberships = await this.#database.query<{ id: string }>(
      `SELECT e.id
         FROM enrollments e
         JOIN students st
           ON st.school_id = e.school_id
          AND st.id = e.student_id
          AND st.status = 'ACTIVE'
        WHERE e.school_id = $1
          AND e.section_id = $2
          AND e.student_id = $3
          AND e.status = 'ACTIVE'
        LIMIT 1`,
      [input.schoolId, input.sectionId, input.studentId],
    );
    if (!memberships[0]) return { status: 'UNAVAILABLE', reason: 'STUDENT_NOT_AVAILABLE_IN_SECTION' };

    const rules = await this.#database.query<StudentAccessRow>(
      `SELECT id, section_id, access_mode
         FROM student_access_rules
        WHERE school_id = $1
          AND student_id = $2
          AND status = 'ACTIVE'
          AND valid_from <= $3::timestamptz
          AND (valid_until IS NULL OR valid_until > $3::timestamptz)
          AND (section_id = $4 OR section_id IS NULL)
        ORDER BY section_id NULLS LAST, valid_from DESC, id`,
      [input.schoolId, input.studentId, input.at.toISOString(), input.sectionId],
    );

    const sectionRules = rules.filter((row) => row.section_id === input.sectionId);
    if (sectionRules.length > 1) {
      return { status: 'CONFLICT', source: 'SECTION', ruleIds: sectionRules.map((row) => row.id) };
    }
    if (sectionRules.length === 1) {
      const rule = sectionRules[0]!;
      return { status: 'RESOLVED', mode: rule.access_mode, source: 'SECTION', ruleId: rule.id };
    }

    const schoolRules = rules.filter((row) => row.section_id === null);
    if (schoolRules.length > 1) {
      return { status: 'CONFLICT', source: 'SCHOOL', ruleIds: schoolRules.map((row) => row.id) };
    }
    if (schoolRules.length === 1) {
      const rule = schoolRules[0]!;
      return { status: 'RESOLVED', mode: rule.access_mode, source: 'SCHOOL', ruleId: rule.id };
    }
    return { status: 'NONE' };
  }
}

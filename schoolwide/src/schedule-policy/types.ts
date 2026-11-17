export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type SchoolLocalClock = {
  instant: string;
  timezone: string;
  academicDate: string;
  localTime: string;
  localSecondOfDay: number;
};

export const sessionFailureReasons = [
  'SECTION_NOT_FOUND_OR_INACTIVE',
  'TIMEZONE_INVALID',
  'SECTION_ACADEMIC_YEAR_MISMATCH',
  'CALENDAR_DAY_MISSING',
  'NO_SCHOOL',
  'SCHEDULE_PROFILE_MISSING',
  'SCHEDULE_PROFILE_INACTIVE',
  'SECTION_PERIOD_UNCONFIGURED',
  'SECTION_PERIOD_NOT_IN_PROFILE',
  'OUTSIDE_SECTION_PERIOD',
] as const;

export type SessionFailureReason = (typeof sessionFailureReasons)[number];

export type CalendarProvenance = {
  calendarDayId: string;
  academicDate: string;
  isSchoolDay: boolean;
  scheduleProfileId: string | null;
  scheduleProfileKey: string | null;
  label: string | null;
  source: string;
  sourceRevision: string | null;
};

export type PeriodProvenance = {
  periodId: string;
  periodCode: string;
  ordinalByTime: number;
  startsAtLocal: string;
  endsAtLocal: string;
};

export type ResolvedSession = {
  status: 'IN_SESSION';
  schoolId: string;
  sectionId: string;
  academicYearId: string;
  clock: SchoolLocalClock;
  calendar: CalendarProvenance;
  period: PeriodProvenance;
};

export type UnresolvedSession = {
  status: 'NO_ACTIVE_SESSION';
  schoolId?: string;
  sectionId: string;
  academicYearId?: string;
  clock?: SchoolLocalClock;
  calendar?: CalendarProvenance;
  period?: PeriodProvenance;
  reason: SessionFailureReason;
};

export type SessionResolution = ResolvedSession | UnresolvedSession;

export const policyFailureReasons = [
  'NO_EFFECTIVE_POLICY_SET',
  'CONFLICTING_POLICY_SETS',
  'MALFORMED_POLICY_VALUE',
] as const;

export type PolicyFailureReason = (typeof policyFailureReasons)[number];

export type RejectedSectionOverride = {
  overrideId: string;
  policyKey: string;
  reason:
    | 'TEACHER_OVERRIDE_NOT_ALLOWED'
    | 'NO_SCHOOL_DEFAULT'
    | 'MALFORMED_OVERRIDE_VALUE'
    | 'CONFLICTING_ACTIVE_OVERRIDES';
};

export type EffectivePolicyValue = {
  policyKey: string;
  value: JsonValue;
  source: 'SCHOOL_DEFAULT' | 'SECTION_OVERRIDE';
  policyValueId: string;
  overrideId?: string;
};

export type StudentAccessResolution =
  | { status: 'NONE' }
  | {
      status: 'RESOLVED';
      mode: 'STANDARD' | 'UNLIMITED' | 'ESCORT_ONLY';
      source: 'SECTION' | 'SCHOOL';
      ruleId: string;
    }
  | {
      status: 'CONFLICT';
      source: 'SECTION' | 'SCHOOL';
      ruleIds: readonly string[];
    }
  | {
      status: 'UNAVAILABLE';
      reason: 'STUDENT_NOT_AVAILABLE_IN_SECTION';
    };

export type ResolvedPolicy = {
  status: 'RESOLVED';
  schoolId: string;
  sectionId: string;
  academicDate: string;
  policySet: {
    id: string;
    academicYearId: string;
    name: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
  };
  values: Readonly<Record<string, EffectivePolicyValue>>;
  rejectedSectionOverrides: readonly RejectedSectionOverride[];
  studentAccess: StudentAccessResolution;
};

export type UnresolvedPolicy = {
  status: 'UNRESOLVED';
  schoolId: string;
  sectionId: string;
  academicDate: string;
  reason: PolicyFailureReason;
};

export type PolicyResolution = ResolvedPolicy | UnresolvedPolicy;

export type SchedulePolicyContext = {
  session: SessionResolution;
  policy: PolicyResolution | null;
};

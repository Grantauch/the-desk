export type ReadyCheckStatus = 'pass' | 'warning' | 'block';
export type ReadyOverallStatus = 'READY' | 'NEEDS_ATTENTION' | 'BLOCKED';

export interface ReadyCheck {
  id: string;
  label: string;
  status: ReadyCheckStatus;
  detail: string;
  assignmentTitle?: string;
  suggestedAction?: string;
}

export interface ReadyCourse {
  courseName: string;
  windowLabel?: string;
  checks: ReadyCheck[];
}

export interface ReadySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  sourceVersion: string;
  courses: ReadyCourse[];
}

export interface ReadySummary {
  status: ReadyOverallStatus;
  pass: number;
  warning: number;
  block: number;
  total: number;
}

const text = (value: unknown, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const checkStatus = (value: unknown): ReadyCheckStatus | null =>
  value === 'pass' || value === 'warning' || value === 'block' ? value : null;

export function validateReadySnapshot(input: unknown): ReadySnapshot {
  if (!input || typeof input !== 'object') throw new Error('Ready snapshot must be a JSON object.');
  const raw = input as Record<string, unknown>;
  if (raw.schemaVersion !== 1) throw new Error('Ready snapshot schemaVersion must be 1.');

  const generatedAt = text(raw.generatedAt, 80);
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('Ready snapshot generatedAt must be a valid timestamp.');
  }

  const source = text(raw.source, 80);
  const sourceVersion = text(raw.sourceVersion, 80);
  if (!source || !sourceVersion) throw new Error('Ready snapshot source and sourceVersion are required.');

  if (!Array.isArray(raw.courses) || raw.courses.length === 0 || raw.courses.length > 50) {
    throw new Error('Ready snapshot must contain between 1 and 50 courses.');
  }

  const courses: ReadyCourse[] = raw.courses.map((courseValue, courseIndex) => {
    if (!courseValue || typeof courseValue !== 'object') {
      throw new Error(`Course ${courseIndex + 1} is invalid.`);
    }
    const course = courseValue as Record<string, unknown>;
    const courseName = text(course.courseName, 160);
    if (!courseName) throw new Error(`Course ${courseIndex + 1} is missing a courseName.`);
    if (!Array.isArray(course.checks) || course.checks.length === 0 || course.checks.length > 100) {
      throw new Error(`${courseName} must contain between 1 and 100 checks.`);
    }

    const checks: ReadyCheck[] = course.checks.map((checkValue, checkIndex) => {
      if (!checkValue || typeof checkValue !== 'object') {
        throw new Error(`${courseName} check ${checkIndex + 1} is invalid.`);
      }
      const check = checkValue as Record<string, unknown>;
      const id = text(check.id, 120);
      const label = text(check.label, 180);
      const status = checkStatus(check.status);
      const detail = text(check.detail, 1000);
      if (!id || !label || !status || !detail) {
        throw new Error(`${courseName} check ${checkIndex + 1} is incomplete.`);
      }
      return {
        id,
        label,
        status,
        detail,
        assignmentTitle: text(check.assignmentTitle, 250) || undefined,
        suggestedAction: text(check.suggestedAction, 500) || undefined,
      };
    });

    const ids = checks.map(check => check.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${courseName} contains duplicate check IDs.`);

    return {
      courseName,
      windowLabel: text(course.windowLabel, 120) || undefined,
      checks,
    };
  });

  return { schemaVersion: 1, generatedAt, source, sourceVersion, courses };
}

export function summarizeReadySnapshot(snapshot: ReadySnapshot): ReadySummary {
  const checks = snapshot.courses.flatMap(course => course.checks);
  const pass = checks.filter(check => check.status === 'pass').length;
  const warning = checks.filter(check => check.status === 'warning').length;
  const block = checks.filter(check => check.status === 'block').length;
  return {
    status: block > 0 ? 'BLOCKED' : warning > 0 ? 'NEEDS_ATTENTION' : 'READY',
    pass,
    warning,
    block,
    total: checks.length,
  };
}

export const sampleReadySnapshot: ReadySnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-09-21T12:00:00-04:00',
  source: 'GoClassroom sample',
  sourceVersion: 'v0.9.x',
  courses: [
    {
      courseName: 'US History - sample',
      windowLabel: 'tomorrow',
      checks: [
        {
          id: 'classroom-access',
          label: 'Classroom opens',
          status: 'pass',
          detail: 'The selected Classwork page opened and the course identity was readable.',
        },
        {
          id: 'due-date',
          label: 'Due date is clear',
          status: 'block',
          detail: 'The assignment due date could not be read clearly.',
          assignmentTitle: 'Sample assignment',
          suggestedAction: 'Open the assignment once and confirm the due date before class.',
        },
        {
          id: 'attachments',
          label: 'Attachments are present',
          status: 'pass',
          detail: 'The expected assignment attachment was visible to the teacher account.',
        },
      ],
    },
    {
      courseName: 'Hidden History - sample',
      windowLabel: 'tomorrow',
      checks: [
        {
          id: 'classroom-access',
          label: 'Classroom opens',
          status: 'pass',
          detail: 'The selected Classwork page opened and the course identity was readable.',
        },
        {
          id: 'instructions',
          label: 'Directions are readable',
          status: 'warning',
          detail: 'Directions exist, but they are unusually short for this assignment type.',
          suggestedAction: 'Review the directions before students begin.',
        },
      ],
    },
  ],
};

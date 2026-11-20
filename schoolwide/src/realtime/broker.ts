import type { RealtimeBroker, RealtimeEnvelope, RealtimeLane, RealtimeListener } from './types.js';

export function realtimeLaneKey(lane: RealtimeLane): string {
  switch (lane.kind) {
    case 'TEACHER_SECTION': return `teacher:${lane.schoolId}:${lane.sectionId}`;
    case 'SECURITY_SCHOOL': return `security:${lane.schoolId}`;
    case 'ADMIN_SCHOOL': return `admin:${lane.schoolId}`;
    case 'STUDENT_SELF': return `student:${lane.schoolId}:${lane.studentId}`;
  }
}

export class InProcessRealtimeBroker implements RealtimeBroker {
  readonly #listeners = new Map<string, Set<RealtimeListener>>();
  readonly #recentEventIds = new Map<string, string[]>();
  readonly #recentLimit: number;

  constructor(recentLimit = 256) {
    if (!Number.isInteger(recentLimit) || recentLimit < 16 || recentLimit > 4096) {
      throw new Error('Realtime broker recent-event limit is invalid.');
    }
    this.#recentLimit = recentLimit;
  }

  async publish(event: RealtimeEnvelope): Promise<void> {
    const key = realtimeLaneKey(event.lane);
    const recent = this.#recentEventIds.get(key) ?? [];
    if (recent.includes(event.id)) return;
    recent.push(event.id);
    if (recent.length > this.#recentLimit) recent.splice(0, recent.length - this.#recentLimit);
    this.#recentEventIds.set(key, recent);

    const listeners = this.#listeners.get(key);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(event);
  }

  subscribe(lane: RealtimeLane, listener: RealtimeListener): () => void {
    const key = realtimeLaneKey(lane);
    let listeners = this.#listeners.get(key);
    if (!listeners) {
      listeners = new Set<RealtimeListener>();
      this.#listeners.set(key, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
      if (listeners?.size === 0) this.#listeners.delete(key);
    };
  }
}

export class DisabledRealtimeBroker implements RealtimeBroker {
  async publish(): Promise<void> {
    throw new Error('Realtime publisher is not configured.');
  }
  subscribe(): () => void {
    return () => undefined;
  }
}

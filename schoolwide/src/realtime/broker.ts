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

  async publish(event: RealtimeEnvelope): Promise<void> {
    const listeners = this.#listeners.get(realtimeLaneKey(event.lane));
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

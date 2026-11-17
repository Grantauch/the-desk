import type { ClassroomScheduledSyncWorker } from './classroom-scheduler.js';
import type { OutboxDeliveryWorker } from './outbox-worker.js';

export type OperationsRuntimeOptions = {
  outboxIntervalMs?: number;
  classroomIntervalMs?: number;
};

export class OperationsRuntime {
  readonly #outbox: OutboxDeliveryWorker;
  readonly #classroom: ClassroomScheduledSyncWorker;
  readonly #outboxIntervalMs: number;
  readonly #classroomIntervalMs: number;
  #outboxTimer: NodeJS.Timeout | null = null;
  #classroomTimer: NodeJS.Timeout | null = null;
  #outboxRunning = false;
  #classroomRunning = false;

  constructor(outbox: OutboxDeliveryWorker, classroom: ClassroomScheduledSyncWorker, options: OperationsRuntimeOptions = {}) {
    this.#outbox = outbox;
    this.#classroom = classroom;
    this.#outboxIntervalMs = options.outboxIntervalMs ?? 1_000;
    this.#classroomIntervalMs = options.classroomIntervalMs ?? 5 * 60_000;
    if (!Number.isInteger(this.#outboxIntervalMs) || this.#outboxIntervalMs < 500 || this.#outboxIntervalMs > 60_000) throw new Error('Outbox interval is invalid.');
    if (!Number.isInteger(this.#classroomIntervalMs) || this.#classroomIntervalMs < 30_000 || this.#classroomIntervalMs > 60 * 60_000) throw new Error('Classroom interval is invalid.');
  }

  start(): void {
    if (this.#outboxTimer || this.#classroomTimer) return;
    const outboxTick = () => {
      if (this.#outboxRunning) return;
      this.#outboxRunning = true;
      void this.#outbox.runBatch().catch(() => undefined).finally(() => { this.#outboxRunning = false; });
    };
    const classroomTick = () => {
      if (this.#classroomRunning) return;
      this.#classroomRunning = true;
      void this.#classroom.runBatch().catch(() => undefined).finally(() => { this.#classroomRunning = false; });
    };
    this.#outboxTimer = setInterval(outboxTick, this.#outboxIntervalMs);
    this.#outboxTimer.unref();
    this.#classroomTimer = setInterval(classroomTick, this.#classroomIntervalMs);
    this.#classroomTimer.unref();
    outboxTick();
    classroomTick();
  }

  stop(): void {
    if (this.#outboxTimer) clearInterval(this.#outboxTimer);
    if (this.#classroomTimer) clearInterval(this.#classroomTimer);
    this.#outboxTimer = null;
    this.#classroomTimer = null;
  }
}
